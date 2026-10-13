const { detallesEsperados, sincronizarDetallePagos } = require('./detallePagos');

const METODOS = [
  { id_metodo_pago: 1, nombre: 'efectivo' },
  { id_metodo_pago: 2, nombre: 'transferencia' },
  { id_metodo_pago: 5, nombre: 'datafono' },
];
const resumen = (filas) => filas.map((f) => `${f.nombre}:${f.monto}`);

describe('detallesEsperados', () => {
  test('mixto: una fila por método con monto > 0', () => {
    expect(resumen(detallesEsperados({ metodo_pago: 'mixto', total: '53000', monto_efectivo: '1000', monto_transferencia: '52000' }, METODOS)))
      .toEqual(['efectivo:1000', 'transferencia:52000']);
  });
  test('métodos simples: una fila por el total', () => {
    expect(resumen(detallesEsperados({ metodo_pago: 'transferencia', total: '67000' }, METODOS))).toEqual(['transferencia:67000']);
    expect(resumen(detallesEsperados({ metodo_pago: 'datafono', total: '52000' }, METODOS))).toEqual(['datafono:52000']);
    expect(resumen(detallesEsperados({ metodo_pago: 'efectivo', total: '40000' }, METODOS))).toEqual(['efectivo:40000']);
  });
  test('el comprobante solo va en la fila de transferencia', () => {
    const filas = detallesEsperados({ metodo_pago: 'mixto', total: 10, monto_efectivo: 4, monto_transferencia: 6 }, METODOS, 'https://x/c.jpg');
    expect(filas.map((f) => f.comprobante)).toEqual([null, 'https://x/c.jpg']);
  });
});

// Base en memoria con lo mínimo que usa sincronizarDetallePagos.
const fakeDb = (pago) => {
  const db = {
    detalles: pago ? [...pago.detallePagos] : [],
    pago: {
      findFirst: jest.fn(async () => (pago ? { ...pago, detallePagos: db.detalles } : null)),
      update: jest.fn(async ({ data }) => Object.assign(pago, data)),
    },
    detallePago: {
      deleteMany: jest.fn(async () => { db.detalles = []; }),
      create: jest.fn(async ({ data }) => { db.detalles.push(data); }),
    },
    metodoPago: { findMany: jest.fn(async () => METODOS) },
  };
  return db;
};

describe('sincronizarDetallePagos', () => {
  test('#164: mixto con detalle viejo de efectivo por el total queda igual a la venta', async () => {
    const pago = { id_pago: 9, total_pagado: '43000', detallePagos: [{ id_metodo_pago: 1, monto: '43000', comprobante: null }] };
    const db = fakeDb(pago);
    await sincronizarDetallePagos(db, { id_venta: 164, metodo_pago: 'mixto', total: '43000', monto_efectivo: '16000', monto_transferencia: '27000' });
    expect(db.detalles.map((d) => [d.id_metodo_pago, d.monto])).toEqual([[1, 16000], [2, 27000]]);
    expect(pago.total_pagado).toBe('43000');
  });

  test('conserva el comprobante que ya tenía el detalle', async () => {
    const db = fakeDb({ id_pago: 3, total_pagado: '50000', detallePagos: [{ id_metodo_pago: 2, monto: '50000', comprobante: 'https://x/c.jpg' }] });
    await sincronizarDetallePagos(db, { id_venta: 1, metodo_pago: 'mixto', total: '50000', monto_efectivo: '10000', monto_transferencia: '40000', comprobante_url: null });
    expect(db.detalles.find((d) => d.id_metodo_pago === 2).comprobante).toBe('https://x/c.jpg');
  });

  test('venta sin pago (no entregada): no crea nada', async () => {
    const db = fakeDb(null);
    expect(await sincronizarDetallePagos(db, { id_venta: 1, metodo_pago: 'mixto', total: 10, monto_efectivo: 4, monto_transferencia: 6 })).toBeNull();
    expect(db.detallePago.create).not.toHaveBeenCalled();
  });
});
