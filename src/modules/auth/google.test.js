// "Continuar con Google" (solo clientes, web). Casos obligatorios:
// admin con Gmail, domiciliario activo e inactivo, cliente existente (vincula,
// anula la contraseña y avisa en pantalla), login con contraseña en cuenta de
// Google, correo nuevo (200 puntos), volver a entrar (sin puntos) y recuperar
// la contraseña después de vincular.
const bcrypt = require('bcryptjs');

const mockDb = { usuarios: [], siguienteId: 100 };
const mockTx = {
  usuario: { create: jest.fn() },
  cliente: { create: jest.fn() },
  puntosCliente: { create: jest.fn() },
  movimientoPuntos: { create: jest.fn() },
};

jest.mock('../../config/prisma', () => {
  const buscar = ({ where }) => {
    const [campo, valor] = Object.entries(where)[0];
    return mockDb.usuarios.find((u) => u[campo] === valor) || null;
  };
  return {
    usuario: {
      findUnique: jest.fn(async (args) => buscar(args)),
      update: jest.fn(async ({ where, data }) => {
        const u = buscar({ where });
        Object.assign(u, data);
        return u;
      }),
    },
    $transaction: jest.fn((fn) => fn(mockTx)),
  };
});
jest.mock('./google', () => ({ verificarCredencial: jest.fn(), disponible: () => true }));
jest.mock('../../utils/mailer', () => ({
  enviarBienvenida: jest.fn().mockResolvedValue(),
  enviarAlertaLogin: jest.fn().mockResolvedValue(),
  enviarCodigoRecuperacion: jest.fn().mockResolvedValue(),
}));
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));

process.env.JWT_SECRET = 'secreto-de-prueba';
const google = require('./google');
const mailer = require('../../utils/mailer');
const authService = require('./service');

const ROLES = {
  cliente:      { id_rol: 4, nombre: 'cliente', estado: 1 },
  admin:        { id_rol: 1, nombre: 'admin', estado: 1 },
  domiciliario: { id_rol: 2, nombre: 'domiciliario', estado: 1 },
};

const usuario = (o) => ({
  id_usuario: mockDb.siguienteId++, nombre: 'Persona', estado: 1, ips_conocidas: [],
  google_sub: null, tiene_contrasena: true, cliente: null, empleado: null, ...o,
  id_rol: (o.rol || ROLES.cliente).id_rol, rol: o.rol || ROLES.cliente,
});

const conGoogle = (email, sub = `sub-${email}`) => {
  google.verificarCredencial.mockResolvedValue({ sub, email, nombre: 'Ana Gómez' });
  return authService.loginConGoogle({ credential: 'token-de-google', ip: '1.2.3.4' });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDb.usuarios = [];
  mockTx.usuario.create.mockImplementation(async ({ data }) => {
    const u = usuario({ ...data, rol: ROLES.cliente });
    mockDb.usuarios.push(u);
    return u;
  });
  mockTx.cliente.create.mockResolvedValue({ id_cliente: 1 });
  mockTx.puntosCliente.create.mockResolvedValue({ id_puntos: 1 });
});

const MSG_SOLO_CONTRASENA = 'Esta cuenta debe ingresar con correo y contraseña';
const sinCambios = () => {
  expect(mockTx.usuario.create).not.toHaveBeenCalled();
  expect(require('../../config/prisma').usuario.update).not.toHaveBeenCalled();
};

test('admin con Gmail: no inicia sesión, no vincula, no crea', async () => {
  mockDb.usuarios.push(usuario({ email: 'jefe@gmail.com', rol: ROLES.admin, contrasena: 'x' }));
  await expect(conGoogle('jefe@gmail.com')).rejects.toMatchObject({ status: 403, message: MSG_SOLO_CONTRASENA });
  sinCambios();
});

test('domiciliario activo: mismo mensaje y nada cambia', async () => {
  mockDb.usuarios.push(usuario({ email: 'domi@gmail.com', rol: ROLES.domiciliario, empleado: { id_empleado: 1 } }));
  await expect(conGoogle('domi@gmail.com')).rejects.toMatchObject({ status: 403, message: MSG_SOLO_CONTRASENA });
  sinCambios();
});

test('domiciliario inactivo: mismo mensaje (no "usuario inactivo") y nada cambia', async () => {
  mockDb.usuarios.push(usuario({ email: 'exdomi@gmail.com', rol: ROLES.domiciliario, estado: 0, empleado: { id_empleado: 2 } }));
  await expect(conGoogle('exdomi@gmail.com')).rejects.toMatchObject({ status: 403, message: MSG_SOLO_CONTRASENA });
  sinCambios();
});

test('cliente existente: vincula, entra a su misma cuenta, anula la contraseña y avisa en pantalla (sin correo)', async () => {
  const hashViejo = await bcrypt.hash('MiClave2026!', 4);
  const ana = usuario({ email: 'ana@gmail.com', contrasena: hashViejo, cliente: { id_cliente: 55 } });
  mockDb.usuarios.push(ana);

  const r = await conGoogle('ana@gmail.com', 'sub-ana');

  expect(r.vinculada).toBe(true);
  expect(r.nueva).toBe(false);
  expect(r.usuario.id_usuario).toBe(ana.id_usuario);        // misma cuenta (puntos, pedidos, direcciones)
  expect(r.usuario.cliente).toEqual({ id_cliente: 55 });
  expect(r.usuario).not.toHaveProperty('contrasena');
  expect(r.usuario).not.toHaveProperty('google_sub');
  expect(ana.google_sub).toBe('sub-ana');
  expect(ana.tiene_contrasena).toBe(false);
  expect(await bcrypt.compare('MiClave2026!', ana.contrasena)).toBe(false); // la anterior ya no sirve
  expect(mockTx.usuario.create).not.toHaveBeenCalled();
  expect(mockTx.puntosCliente.create).not.toHaveBeenCalled();
  expect(mailer.enviarBienvenida).not.toHaveBeenCalled();
  expect(mailer.enviarAlertaLogin).not.toHaveBeenCalled();
  expect(typeof r.token).toBe('string');
});

test('login con contraseña en una cuenta de Google: mensaje que indica cómo entrar', async () => {
  mockDb.usuarios.push(usuario({ email: 'ana@gmail.com', contrasena: await bcrypt.hash('lo-que-sea', 4), tiene_contrasena: false, google_sub: 'sub-ana' }));
  await expect(authService.login({ email: 'ana@gmail.com', contrasena: 'lo-que-sea' })).rejects.toMatchObject({
    status: 401,
    message: "Esta cuenta usa Google para iniciar sesión. Toca 'Continuar con Google' o crea una contraseña desde '¿Olvidaste tu contraseña?'",
  });
});

test('login con contraseña: correo inexistente y contraseña mala siguen diciendo "Credenciales inválidas"', async () => {
  mockDb.usuarios.push(usuario({ email: 'ana@gmail.com', contrasena: await bcrypt.hash('buena', 4) }));
  await expect(authService.login({ email: 'nadie@gmail.com', contrasena: 'x' })).rejects.toMatchObject({ message: 'Credenciales inválidas' });
  await expect(authService.login({ email: 'ana@gmail.com', contrasena: 'mala' })).rejects.toMatchObject({ message: 'Credenciales inválidas' });
});

test('correo nuevo: crea cliente con nombre y correo de Google y 200 puntos', async () => {
  const r = await conGoogle('nuevo@gmail.com', 'sub-nuevo');
  expect(r.nueva).toBe(true);
  expect(r.vinculada).toBe(false);
  expect(mockTx.usuario.create.mock.calls[0][0].data).toMatchObject({
    nombre: 'Ana Gómez', email: 'nuevo@gmail.com', id_rol: 4, google_sub: 'sub-nuevo', tiene_contrasena: false,
  });
  expect(mockTx.puntosCliente.create).toHaveBeenCalledWith({ data: { id_cliente: 1, puntos: 200 } });
  expect(mockTx.movimientoPuntos.create).toHaveBeenCalledTimes(1);
});

test('volver a entrar con Google: misma cuenta, sin puntos nuevos ni aviso de vinculación', async () => {
  await conGoogle('nuevo@gmail.com', 'sub-nuevo');
  jest.clearAllMocks();
  const r = await conGoogle('nuevo@gmail.com', 'sub-nuevo');
  expect(r.nueva).toBe(false);
  expect(r.vinculada).toBe(false);
  expect(mockTx.usuario.create).not.toHaveBeenCalled();
  expect(mockTx.puntosCliente.create).not.toHaveBeenCalled();
  expect(mockTx.movimientoPuntos.create).not.toHaveBeenCalled();
});

test('recuperar la contraseña después de vincular: entra de las dos formas', async () => {
  mockDb.usuarios.push(usuario({ email: 'ana@gmail.com', contrasena: await bcrypt.hash('vieja', 4), cliente: { id_cliente: 55 } }));
  await conGoogle('ana@gmail.com', 'sub-ana');

  await authService.solicitarReset({ email: 'ana@gmail.com' });
  const codigo = mailer.enviarCodigoRecuperacion.mock.calls.at(-1)[1];
  await authService.verificarReset({ email: 'ana@gmail.com', codigo, nueva_password: 'NuevaClave2026!' });

  const ana = mockDb.usuarios.find((u) => u.email === 'ana@gmail.com');
  expect(ana.tiene_contrasena).toBe(true);
  await expect(authService.login({ email: 'ana@gmail.com', contrasena: 'NuevaClave2026!' })).resolves.toHaveProperty('token');
  await expect(conGoogle('ana@gmail.com', 'sub-ana')).resolves.toMatchObject({ vinculada: false });
});

test('mismo correo conectado a OTRA cuenta de Google: 409, no se cambia', async () => {
  mockDb.usuarios.push(usuario({ email: 'ana@gmail.com', google_sub: 'sub-original', tiene_contrasena: false }));
  await expect(conGoogle('ana@gmail.com', 'sub-distinto')).rejects.toMatchObject({ status: 409 });
});
