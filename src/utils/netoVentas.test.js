const { netoVentas, mesAnioColombia } = require('./netoVentas');

const v = (metodo_pago, total, costo_domicilio, monto_efectivo = 0, monto_transferencia = 0) =>
  ({ metodo_pago, total, costo_domicilio, monto_efectivo, monto_transferencia });

describe('netoVentas', () => {
  test('resta los domicilios una sola vez, del efectivo', () => {
    const r = netoVentas([
      v('efectivo', 51000, 7000, 51000),
      v('transferencia', 53000, 13000, 0, 53000),
      v('datafono', 40000, 5000),
    ]);
    expect(r).toMatchObject({ efectivoBruto: 51000, domicilios: 25000, efectivo: 26000, transferencia: 53000, datafono: 40000 });
    expect(r.neto).toBe(119000);
  });

  test('mixto reparte efectivo y transferencia', () => {
    const r = netoVentas([v('mixto', 60000, 10000, 20000, 40000)]);
    expect(r).toMatchObject({ efectivo: 10000, transferencia: 40000, neto: 50000 });
  });

  test('neto siempre es la suma del desglose', () => {
    const r = netoVentas([v('efectivo', 94000, 18000, 94000), v('transferencia', 24000, 6000, 0, 24000)]);
    expect(r.neto).toBe(r.efectivo + r.transferencia + r.datafono);
  });

  test('lista vacía da cero', () => {
    expect(netoVentas([]).neto).toBe(0);
  });
});

describe('mesAnioColombia', () => {
  test('30-sep 7pm Colombia (01-oct 00:03 UTC) es septiembre', () => {
    expect(mesAnioColombia(new Date('2026-10-01T00:03:07.586Z'))).toEqual({ mes: 9, anio: 2026 });
  });
  test('01-oct 00:00 Colombia (05:00 UTC) ya es octubre', () => {
    expect(mesAnioColombia(new Date('2026-10-01T05:00:00.000Z'))).toEqual({ mes: 10, anio: 2026 });
  });
  test('31-dic 11pm Colombia sigue en el año anterior', () => {
    expect(mesAnioColombia(new Date('2027-01-01T04:00:00.000Z'))).toEqual({ mes: 12, anio: 2026 });
  });
});
