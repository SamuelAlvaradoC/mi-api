const { validarMontosMixto } = require('./montosMixto');

describe('validarMontosMixto', () => {
  test('acepta montos que suman el total (con domicilio incluido)', () => {
    expect(() => validarMontosMixto(60000, 7000, 53000)).not.toThrow();
  });

  test('acepta montos que llegan como string (Decimal de Prisma)', () => {
    expect(() => validarMontosMixto('60000', '7000', '53000')).not.toThrow();
  });

  test('rechaza montos que suman de más (caso #157)', () => {
    expect(() => validarMontosMixto(46000, 15000, 33000)).toThrow(expect.objectContaining({ status: 400 }));
  });

  test('rechaza montos que suman de menos', () => {
    expect(() => validarMontosMixto(60000, 0, 0)).toThrow(expect.objectContaining({ status: 400 }));
  });

  test('rechaza montos negativos o no numéricos', () => {
    expect(() => validarMontosMixto(60000, -1000, 61000)).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => validarMontosMixto(60000, 'abc', 60000)).toThrow(expect.objectContaining({ status: 400 }));
  });
});
