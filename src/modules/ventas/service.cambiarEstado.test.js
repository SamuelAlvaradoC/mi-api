jest.mock('../../config/prisma', () => ({
  venta:            { findUnique: jest.fn(), update: jest.fn() },
  estado:           { findFirst: jest.fn() },
  empleado:         { findUnique: jest.fn() },
  // Solo se tocan cuando estadoAnterior === 'entregado' (reversion de puntos
  // al retroceder desde entregado) -- findFirst sin mockResolvedValue ya
  // resuelve a undefined, que es justo lo que este test necesita (sin
  // movimiento previo que revertir).
  movimientoPuntos: { findFirst: jest.fn(), create: jest.fn() },
  puntosCliente:    { findUnique: jest.fn(), update: jest.fn() },
}));
jest.mock('../../socket', () => ({ getIo: jest.fn() }));
jest.mock('../puntos/service', () => ({
  acumularPuntos:          jest.fn(),
  calcularDescuentoPuntos: jest.fn(),
  obtenerPuntos:           jest.fn(),
}));
jest.mock('../../utils/logger', () => ({
  error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn(), debug: jest.fn(),
}));

const prisma = require('../../config/prisma');
const { getIo } = require('../../socket');
const service = require('./service');

// Venta minima con todo lo que obtener()/armarPayloadImpresion necesitan.
// id_domiciliario e id_cliente en null evitan que obtener() dispare el
// lookup de empleado y que armarPayloadImpresion llame a obtenerPuntos --
// ninguno de los dos es relevante para lo que este test verifica.
const mockVenta = (estadoActual) => ({
  id_venta: 1,
  id_domiciliario: null,
  id_cliente: null,
  puntos_usados: 0,
  descuento_puntos: 0,
  subtotal: 20000,
  total: 20000,
  costo_domicilio: 0,
  metodo_pago: 'efectivo',
  monto_efectivo: 20000,
  monto_transferencia: 0,
  observaciones: null,
  nombre_cliente: null,
  telefono_cliente: null,
  direccion: null,
  cliente: null,
  detalleVentas: [],
  fecha: new Date('2026-08-20T12:00:00.000Z'),
  estado: { id_estado: { despachado: 4, entregado: 5 }[estadoActual] || 2, nombre_estado: estadoActual },
});

describe('cambiarEstado — impresion del comprobante al pasar a "listo"', () => {
  let emit;

  beforeEach(() => {
    jest.clearAllMocks();
    emit = jest.fn();
    getIo.mockReturnValue({ emit });
    prisma.estado.findFirst.mockResolvedValue({ id_estado: 3, nombre_estado: 'listo' });
    prisma.venta.update.mockResolvedValue({ id_venta: 1 });
  });

  test('SI imprime: primera vez que llega a "listo" (ej. desde Cocina, estado anterior "confirmado")', async () => {
    prisma.venta.findUnique.mockResolvedValue(mockVenta('confirmado'));

    await service.cambiarEstado(1, { nombre_estado: 'listo' }, 99);

    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('pedido_listo', expect.objectContaining({ id_venta: 1 }));
  });

  test('NO imprime: reingreso a "listo" desde "despachado" (Devolver a Listo / devolver del domiciliario)', async () => {
    prisma.venta.findUnique.mockResolvedValue(mockVenta('despachado'));

    await service.cambiarEstado(1, { nombre_estado: 'listo' }, 99);

    expect(emit).not.toHaveBeenCalled();
  });

  test('NO imprime: reingreso a "listo" desde "entregado" (venta marcada entregada por error y devuelta)', async () => {
    prisma.venta.findUnique.mockResolvedValue(mockVenta('entregado'));

    await service.cambiarEstado(1, { nombre_estado: 'listo' }, 99);

    expect(emit).not.toHaveBeenCalled();
  });
});
