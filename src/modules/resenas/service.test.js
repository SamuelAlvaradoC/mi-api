// Reseñas: la encuesta general es pública, pero una reseña de un pedido
// (id_venta) solo la puede hacer el cliente dueño de ese pedido.
jest.mock('../../config/prisma', () => ({
  venta: { findUnique: jest.fn() },
  resena: { create: jest.fn() },
}));
const prisma = require('../../config/prisma');
const service = require('./service');

const resena = { sede: 'Aranjuez', calificacion_atencion: 5, calificacion_producto: 5 };
const venta = (o = {}) => ({ id_venta: 30, estado: { nombre_estado: 'entregado' }, resena: null, cliente: { id_usuario: 7 }, ...o });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.resena.create.mockImplementation(async ({ data }) => ({ id_resena: 1, ...data }));
});

test('encuesta general sin pedido: se acepta sin sesión', async () => {
  await service.crear({ ...resena, id_usuario: null });
  expect(prisma.resena.create).toHaveBeenCalled();
});

test('reseña de un pedido sin sesión: 401', async () => {
  await expect(service.crear({ ...resena, id_venta: 30, id_usuario: null })).rejects.toMatchObject({ status: 401 });
  expect(prisma.resena.create).not.toHaveBeenCalled();
});

test('reseña del pedido de OTRO cliente: 403', async () => {
  prisma.venta.findUnique.mockResolvedValue(venta());
  await expect(service.crear({ ...resena, id_venta: 30, id_usuario: 8 })).rejects.toMatchObject({ status: 403 });
  expect(prisma.resena.create).not.toHaveBeenCalled();
});

test('reseña de su propio pedido entregado: se guarda con su usuario', async () => {
  prisma.venta.findUnique.mockResolvedValue(venta());
  await service.crear({ ...resena, id_venta: 30, id_usuario: 7 });
  expect(prisma.resena.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id_venta: 30, id_usuario: 7 }) });
});

test('su propio pedido pero ya reseñado o no entregado: 400', async () => {
  prisma.venta.findUnique.mockResolvedValue(venta({ resena: { id_resena: 2 } }));
  await expect(service.crear({ ...resena, id_venta: 30, id_usuario: 7 })).rejects.toMatchObject({ status: 400 });
  prisma.venta.findUnique.mockResolvedValue(venta({ estado: { nombre_estado: 'pendiente' } }));
  await expect(service.crear({ ...resena, id_venta: 30, id_usuario: 7 })).rejects.toMatchObject({ status: 400 });
});
