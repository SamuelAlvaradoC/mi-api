// Pedido hecho fuera de horario con el aviso aceptado: se guarda como un
// pedido normal (pendiente) con fecha = próxima apertura y fecha_real = hora
// real. Y la confirmadora lo ve de inmediato: su lista de pendientes no
// filtra por fecha.
jest.mock('../../config/prisma', () => ({
  cliente:   { findUnique: jest.fn(), create: jest.fn() },
  direccion: { findFirst: jest.fn(), findUnique: jest.fn() },
  barrio:    { findUnique: jest.fn() },
  producto:  { findMany: jest.fn() },
  topping:   { findMany: jest.fn() },
  adicion:   { findMany: jest.fn() },
  estado:    { findFirst: jest.fn() },
  venta:     { create: jest.fn(), findMany: jest.fn() },
}));
jest.mock('../../socket', () => ({ getIo: jest.fn() }));
jest.mock('../puntos/service', () => ({
  acumularPuntos: jest.fn(), calcularDescuentoPuntos: jest.fn(), obtenerPuntos: jest.fn(), valorPunto: jest.fn(),
}));
jest.mock('../configuracion/service', () => ({ datafonoHabilitado: jest.fn().mockResolvedValue(true) }));
jest.mock('../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn(), debug: jest.fn() }));

const prisma = require('../../config/prisma');
const service = require('./service');

const pedido = { id_direccion: 7, items: [{ id_producto: 1, cantidad: 1 }], metodo_pago: 'efectivo' };

beforeEach(() => {
  jest.clearAllMocks();
  prisma.cliente.findUnique.mockResolvedValue({ id_cliente: 10, telefono: '3001234567', usuario: { nombre: 'Ana' } });
  prisma.direccion.findFirst.mockResolvedValue({ id_direccion: 7 });
  prisma.direccion.findUnique.mockResolvedValue({ id_barrio: 3, direccion_linea: 'Calle 1', barrio: 'Centro', ciudad: 'Medellín', referencia: null });
  prisma.barrio.findUnique.mockResolvedValue({ precio_domicilio: 5000 });
  prisma.producto.findMany.mockResolvedValue([{ id_producto: 1, precio: '20000', max_toppings: 0, permite_toppings: 0 }]);
  prisma.estado.findFirst.mockResolvedValue({ id_estado: 1, nombre_estado: 'pendiente' });
  prisma.venta.create.mockImplementation(async ({ data }) => ({ id_venta: 900, ...data }));
});

test('con el aviso aceptado: pendiente, fecha = apertura y fecha_real = hora real', async () => {
  const apertura = new Date('2026-10-20T18:00:00.000Z'); // martes 1:00 PM Colombia
  const antes = Date.now();
  await service.crearMiPedido(5, pedido, apertura);
  const data = prisma.venta.create.mock.calls[0][0].data;

  expect(data.id_estado).toBe(1);                       // pedido normal: pendiente
  expect(data.fecha).toEqual(apertura);                 // cuenta el día de apertura
  expect(data.fecha_real).toBeInstanceOf(Date);         // hora real guardada
  expect(data.fecha_real.getTime()).toBeGreaterThanOrEqual(antes);
  expect(data.total).toBe(25000);                       // precio y domicilio igual que siempre
});

test('dentro del horario: no toca la fecha (la pone la base) ni fecha_real', async () => {
  await service.crearMiPedido(5, pedido);
  const data = prisma.venta.create.mock.calls[0][0].data;
  expect(data).not.toHaveProperty('fecha');
  expect(data).not.toHaveProperty('fecha_real');
});

test('la confirmadora lo ve de inmediato: la lista de pendientes no filtra por fecha', async () => {
  prisma.venta.findMany.mockResolvedValue([]);
  await service.listar({ estado: 'pendiente' }); // lo que piden su panel web y su app
  const args = prisma.venta.findMany.mock.calls[0][0];
  expect(args.where).toEqual({ id_estado: 1 });  // sin "fecha": incluye los de mañana
  expect(args.orderBy).toEqual({ id_venta: 'asc' }); // por orden de llegada
});
