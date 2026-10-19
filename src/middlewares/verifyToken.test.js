// Sesiones: si la cuenta se desactiva, su rol se desactiva o le cambian el
// rol, el token deja de servir de inmediato (401, que cierra la sesión en la
// web y la app).
jest.mock('../config/prisma', () => ({ usuario: { findUnique: jest.fn() } }));
jest.mock('../modules/auth/service', () => ({ isBlacklisted: () => false }));
jest.mock('../utils/logger', () => ({ error: jest.fn() }));

process.env.JWT_SECRET = 'secreto-de-prueba';
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const verifyToken = require('./verifyToken');
const { limpiarCacheSesiones } = require('../utils/sesionUsuario');

const token = jwt.sign({ id_usuario: 5, id_rol: 2, email: 'domi@example.com' }, 'secreto-de-prueba');
const cuenta = (o = {}) => ({ estado: 1, id_rol: 2, rol: { estado: 1 }, ...o });

const llamar = async () => {
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  await verifyToken(req, res, next);
  return { req, res, next };
};

beforeEach(() => { jest.clearAllMocks(); limpiarCacheSesiones(); });

test('cuenta activa con el mismo rol: pasa', async () => {
  prisma.usuario.findUnique.mockResolvedValue(cuenta());
  const { next, req } = await llamar();
  expect(next).toHaveBeenCalled();
  expect(req.user.id_usuario).toBe(5);
});

test.each([
  ['cuenta desactivada', cuenta({ estado: 0 }), /desactivada/],
  ['rol desactivado', cuenta({ rol: { estado: 0 } }), /rol se encuentra inactivo/],
  ['le cambiaron el rol', cuenta({ id_rol: 4 }), /permisos cambiaron/],
  ['cuenta eliminada', null, /ya no existe/],
])('%s: 401 y no pasa', async (_, valor, mensaje) => {
  prisma.usuario.findUnique.mockResolvedValue(valor);
  const { next, res } = await llamar();
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(401);
  expect(res.json.mock.calls[0][0].message).toMatch(mensaje);
});

test('se desactiva con la sesión abierta: al vaciar la caché, la siguiente petición ya falla', async () => {
  prisma.usuario.findUnique.mockResolvedValue(cuenta());
  expect((await llamar()).next).toHaveBeenCalled();
  prisma.usuario.findUnique.mockResolvedValue(cuenta({ estado: 0 }));
  expect((await llamar()).next).toHaveBeenCalled(); // aún en caché (máx. unos segundos)
  limpiarCacheSesiones();                              // lo hace app.js tras el cambio del admin
  const { next, res } = await llamar();
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(401);
});

test('si la base falla: 503 (no 401, para no cerrar la sesión por un error nuestro)', async () => {
  prisma.usuario.findUnique.mockRejectedValue(new Error('sin conexión'));
  const { next, res } = await llamar();
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(503);
});
