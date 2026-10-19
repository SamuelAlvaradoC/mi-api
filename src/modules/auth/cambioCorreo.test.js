// Cambio de correo: solo con código enviado al correo NUEVO, y nunca a un
// correo que ya usa otra cuenta. editarPerfil ya no cambia el correo directo.
jest.mock('../../config/prisma', () => ({
  usuario: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  cliente: { findUnique: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
}));
jest.mock('../../utils/mailer', () => ({
  enviarCodigoCambioCorreo: jest.fn().mockResolvedValue(),
  enviarAvisoCambioCorreo: jest.fn().mockResolvedValue(),
  enviarBienvenida: jest.fn(), enviarAlertaLogin: jest.fn(), enviarCodigoRecuperacion: jest.fn(),
}));
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() }));

const prisma = require('../../config/prisma');
const mailer = require('../../utils/mailer');
const cambioCorreo = require('./cambioCorreo');
const authService = require('./service');

const ID = 7;
const codigoEnviado = () => mailer.enviarCodigoCambioCorreo.mock.calls.at(-1)[1];

beforeEach(() => {
  jest.clearAllMocks();
  cambioCorreo._pendientes.clear();
  prisma.usuario.findUnique.mockResolvedValue({ email: 'viejo@example.com', nombre: 'Ana' });
  prisma.usuario.findFirst.mockResolvedValue(null);
  prisma.usuario.update.mockImplementation(async ({ data }) => ({ id_usuario: ID, ...data }));
  prisma.cliente.findUnique.mockResolvedValue({ telefono: null });
});

test('manda el código al correo NUEVO y no cambia nada todavía', async () => {
  await cambioCorreo.solicitar(ID, 'nuevo@example.com');
  expect(mailer.enviarCodigoCambioCorreo).toHaveBeenCalledWith('nuevo@example.com', expect.stringMatching(/^\d{6}$/));
  expect(prisma.usuario.update).not.toHaveBeenCalled();
});

test('un correo que ya usa otra cuenta se rechaza (409) sin mandar código', async () => {
  prisma.usuario.findFirst.mockResolvedValue({ id_usuario: 99 });
  await expect(cambioCorreo.solicitar(ID, 'otro@example.com')).rejects.toMatchObject({ status: 409 });
  expect(mailer.enviarCodigoCambioCorreo).not.toHaveBeenCalled();
});

test('con el código correcto cambia el correo y avisa al correo anterior', async () => {
  await cambioCorreo.solicitar(ID, 'nuevo@example.com');
  const u = await cambioCorreo.confirmar(ID, codigoEnviado());
  expect(prisma.usuario.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id_usuario: ID }, data: { email: 'nuevo@example.com' } }));
  expect(u.email).toBe('nuevo@example.com');
  expect(mailer.enviarAvisoCambioCorreo).toHaveBeenCalledWith('viejo@example.com', 'Ana', 'nuevo@example.com');
});

test('código incorrecto: 400; al tercer intento se anula (429)', async () => {
  await cambioCorreo.solicitar(ID, 'nuevo@example.com');
  const bueno = codigoEnviado();
  const malo = bueno === '000000' ? '111111' : '000000';
  await expect(cambioCorreo.confirmar(ID, malo)).rejects.toMatchObject({ status: 400 });
  await expect(cambioCorreo.confirmar(ID, malo)).rejects.toMatchObject({ status: 400 });
  await expect(cambioCorreo.confirmar(ID, malo)).rejects.toMatchObject({ status: 429 });
  await expect(cambioCorreo.confirmar(ID, bueno)).rejects.toMatchObject({ status: 400 }); // ya no existe
  expect(prisma.usuario.update).not.toHaveBeenCalled();
});

test('si otra cuenta tomó el correo mientras tanto, no se cambia (409)', async () => {
  await cambioCorreo.solicitar(ID, 'nuevo@example.com');
  prisma.usuario.findFirst.mockResolvedValue({ id_usuario: 99 });
  await expect(cambioCorreo.confirmar(ID, codigoEnviado())).rejects.toMatchObject({ status: 409 });
  expect(prisma.usuario.update).not.toHaveBeenCalled();
});

test('no se puede pedir otro código antes de un minuto', async () => {
  await cambioCorreo.solicitar(ID, 'nuevo@example.com');
  await expect(cambioCorreo.solicitar(ID, 'nuevo@example.com')).rejects.toMatchObject({ status: 429 });
});

test('editarPerfil con un correo distinto se rechaza; con el mismo, sigue normal', async () => {
  await expect(authService.editarPerfil(ID, { email: 'nuevo@example.com' })).rejects.toMatchObject({ status: 400 });
  expect(prisma.usuario.update).not.toHaveBeenCalled();

  await authService.editarPerfil(ID, { email: 'viejo@example.com', nombre: 'Ana María' });
  expect(prisma.usuario.update.mock.calls[0][0].data).toEqual({ nombre: 'Ana María' });
});
