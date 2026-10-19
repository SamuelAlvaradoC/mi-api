// crearMiPedido: el id_direccion llega del cliente; solo se acepta si la
// dirección es de ese mismo cliente (antes se podía usar la de otro y el
// pedido copiaba su calle, barrio y referencia).
jest.mock('../../config/prisma', () => ({
  cliente:   { findUnique: jest.fn(), create: jest.fn() },
  direccion: { findFirst: jest.fn(), findUnique: jest.fn() },
  venta:     { create: jest.fn() },
}));
jest.mock('../../socket', () => ({ getIo: jest.fn() }));
jest.mock('../puntos/service', () => ({
  acumularPuntos: jest.fn(), calcularDescuentoPuntos: jest.fn(), obtenerPuntos: jest.fn(), valorPunto: jest.fn(),
}));
jest.mock('../configuracion/service', () => ({ datafonoHabilitado: jest.fn().mockResolvedValue(true) }));
jest.mock('../../utils/logger', () => ({
  error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn(), debug: jest.fn(),
}));

const prisma = require('../../config/prisma');
const service = require('./service');

const pedido = (o) => ({ id_direccion: 777, items: [{ id_producto: 1, cantidad: 1 }], metodo_pago: 'efectivo', ...o });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.cliente.findUnique.mockResolvedValue({ id_cliente: 10 });
});

test('una dirección de otro cliente se rechaza con 404 y no se crea el pedido', async () => {
  prisma.direccion.findFirst.mockResolvedValue(null); // no es de id_cliente 10
  await expect(service.crearMiPedido(5, pedido())).rejects.toMatchObject({ status: 404, message: 'Dirección no encontrada' });
  expect(prisma.direccion.findFirst).toHaveBeenCalledWith({
    where: { id_direccion: 777, id_cliente: 10 }, select: { id_direccion: true },
  });
  expect(prisma.direccion.findUnique).not.toHaveBeenCalled();
  expect(prisma.venta.create).not.toHaveBeenCalled();
});

test('una dirección propia pasa la verificación (sigue a la validación del barrio)', async () => {
  prisma.direccion.findFirst.mockResolvedValue({ id_direccion: 777 });
  prisma.direccion.findUnique.mockResolvedValue({ id_barrio: null }); // corta antes de crear la venta
  await expect(service.crearMiPedido(5, pedido())).rejects.toMatchObject({ status: 400 });
  expect(prisma.direccion.findUnique).toHaveBeenCalled();
});
