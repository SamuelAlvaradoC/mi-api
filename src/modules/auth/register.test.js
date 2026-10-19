// Registro público: SIEMPRE crea un cliente, aunque el cliente mande otro
// id_rol (antes se usaba el id_rol recibido y se podía crear un admin).
const mockTx = {
  usuario: { create: jest.fn() },
  cliente: { create: jest.fn() },
  puntosCliente: { create: jest.fn() },
  movimientoPuntos: { create: jest.fn() },
  empleado: { create: jest.fn() },
};
jest.mock('../../config/prisma', () => ({
  usuario: { findUnique: jest.fn() },
  rol: { findUnique: jest.fn() },
  $transaction: jest.fn((fn) => fn(mockTx)),
}));
// sanitize-html trae dependencias ESM que jest no transforma; aquí basta
// una versión simple.
jest.mock('../../utils/validarSinHtml', () => ({
  noContengaHtml: (v) => v == null || !/<[^>]*>/.test(String(v)),
  MSG_HTML: 'No se permiten etiquetas HTML',
}));
jest.mock('../../utils/mailer', () => ({
  enviarBienvenida: jest.fn().mockResolvedValue(),
  enviarAlertaLogin: jest.fn().mockResolvedValue(),
  enviarCodigoRecuperacion: jest.fn().mockResolvedValue(),
}));

const prisma = require('../../config/prisma');
const { registerSchema } = require('./schema');
const authService = require('./service');

beforeEach(() => {
  jest.clearAllMocks();
  prisma.usuario.findUnique.mockResolvedValue(null);
  mockTx.usuario.create.mockImplementation(async ({ data }) => ({ id_usuario: 99, ...data, rol: { id_rol: data.id_rol } }));
  mockTx.cliente.create.mockResolvedValue({ id_cliente: 50 });
  mockTx.puntosCliente.create.mockResolvedValue({ id_puntos: 70 });
});

const cuerpo = (o) => ({ nombre: 'Ana Gómez', email: 'ana@example.com', contrasena: 'Segura2026!', ...o });

test('el schema del registro público descarta id_rol', () => {
  const datos = registerSchema.parse(cuerpo({ id_rol: 1 }));
  expect(datos).not.toHaveProperty('id_rol');
});

test.each([1, 2, 3, 5, 4, undefined])('mandar id_rol %p crea un cliente (id_rol 4) con sus 200 puntos', async (id_rol) => {
  const datos = registerSchema.parse(cuerpo(id_rol === undefined ? {} : { id_rol }));
  const usuario = await authService.register(datos);

  expect(mockTx.usuario.create.mock.calls[0][0].data.id_rol).toBe(4);
  expect(usuario.id_rol).toBe(4);
  expect(usuario).not.toHaveProperty('contrasena');
  expect(mockTx.cliente.create).toHaveBeenCalledWith({ data: { id_usuario: 99 } });
  expect(mockTx.puntosCliente.create).toHaveBeenCalledWith({ data: { id_cliente: 50, puntos: 200 } });
  expect(mockTx.empleado.create).not.toHaveBeenCalled();
});

test('aunque se llame al servicio directo con id_rol 1, crea un cliente', async () => {
  await authService.register({ ...cuerpo(), id_rol: 1 });
  expect(mockTx.usuario.create.mock.calls[0][0].data.id_rol).toBe(4);
  expect(mockTx.empleado.create).not.toHaveBeenCalled();
});

test('correo ya registrado: 409 y no crea nada', async () => {
  prisma.usuario.findUnique.mockResolvedValue({ id_usuario: 1 });
  await expect(authService.register(registerSchema.parse(cuerpo()))).rejects.toMatchObject({ status: 409 });
  expect(mockTx.usuario.create).not.toHaveBeenCalled();
});
