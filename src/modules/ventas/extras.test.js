// Toppings y adiciones de un pedido: inexistentes o inactivos -> 400 claro
// (antes: 500 por llave foránea o precio NaN, y los inactivos se aceptaban).
// También: el comprobante solo se acepta de nuestra cuenta de Cloudinary.
jest.mock('../../config/prisma', () => ({
  topping: { findMany: jest.fn() },
  adicion: { findMany: jest.fn() },
}));
jest.mock('../../utils/validarSinHtml', () => ({ noContengaHtml: () => true, MSG_HTML: '' }));
const prisma = require('../../config/prisma');
const { validarExtras } = require('./extras');
const { crearMiPedidoSchema, estadoVentaSchema } = require('./schema');

beforeEach(() => {
  prisma.topping.findMany.mockResolvedValue([
    { id_topping: 10, nombre: 'Oreo', estado: 1 }, { id_topping: 11, nombre: 'Coco', estado: 0 },
  ]);
  prisma.adicion.findMany.mockResolvedValue([
    { id_adicion: 20, nombre: 'Nutella', estado: 1, precio: '4000' }, { id_adicion: 21, nombre: 'Helado', estado: 0, precio: '3000' },
  ]);
});

const item = (o) => ({ id_producto: 1, cantidad: 1, toppings: [], adiciones: [], ...o });

test('activos: pasan, y los ids sueltos quedan como { id, cantidad: 1 }', async () => {
  const r = await validarExtras([item({ toppings: [10], adiciones: [20, { id_adicion: 20, cantidad: 2 }] })], { exigirActivos: true });
  expect(r.items[0].toppings).toEqual([{ id_topping: 10, cantidad: 1 }]);
  expect(r.items[0].adiciones).toEqual([{ id_adicion: 20, cantidad: 1 }, { id_adicion: 20, cantidad: 2 }]);
  expect(r.precioA[20]).toBe(4000);
});

test.each([
  ['topping inactivo', item({ toppings: [11] }), /topping "Coco" ya no está disponible/],
  ['adición inactiva', item({ adiciones: [{ id_adicion: 21, cantidad: 1 }] }), /adición "Helado" ya no está disponible/],
  ['topping inexistente', item({ toppings: [999] }), /topping 999 no existe/],
  ['adición inexistente', item({ adiciones: [998] }), /adición 998 no existe/],
])('al crear, %s: 400', async (_, it, mensaje) => {
  await expect(validarExtras([it], { exigirActivos: true })).rejects.toMatchObject({ status: 400, message: expect.stringMatching(mensaje) });
});

test('al editar un pedido: se aceptan inactivos (ya estaban en el pedido) pero no inexistentes', async () => {
  await expect(validarExtras([item({ toppings: [11], adiciones: [21] })], { exigirActivos: false })).resolves.toBeTruthy();
  await expect(validarExtras([item({ toppings: [999] })], { exigirActivos: false })).rejects.toMatchObject({ status: 400 });
});

describe('comprobante de pago', () => {
  const pedido = (url) => ({ id_direccion: 1, items: [item()], comprobante_url: url });

  test('se acepta de nuestra cuenta de Cloudinary, vacío u omitido', () => {
    expect(crearMiPedidoSchema.safeParse(pedido('https://res.cloudinary.com/dnoxlv5kn/image/upload/v1/abc.jpg')).success).toBe(true);
    expect(crearMiPedidoSchema.safeParse(pedido('')).success).toBe(true);
    expect(crearMiPedidoSchema.safeParse(pedido(undefined)).success).toBe(true);
  });

  test.each([
    'https://res.cloudinary.com/otra-cuenta/image/upload/v1/abc.jpg',
    'https://ejemplo.com/res.cloudinary.com/dnoxlv5kn/x.jpg',
    'http://res.cloudinary.com/dnoxlv5kn/image/upload/v1/abc.jpg',
  ])('se rechaza %s', (url) => {
    expect(crearMiPedidoSchema.safeParse(pedido(url)).success).toBe(false);
    expect(estadoVentaSchema.safeParse({ id_estado: 2, comprobante_url: url }).success).toBe(false);
  });
});
