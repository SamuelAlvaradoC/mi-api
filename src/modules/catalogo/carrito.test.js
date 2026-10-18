jest.mock('../../config/prisma', () => ({
  producto: { findMany: jest.fn() },
  topping: { findMany: jest.fn() },
  adicion: { findMany: jest.fn() },
  carritoGuardado: { findUnique: jest.fn(), upsert: jest.fn() },
}));
const prisma = require('../../config/prisma');
const carrito = require('./carrito');

const prod = (o) => ({ id_producto: 1, nombre: 'Fresas con crema', precio: '20000', estado: 1, permite_toppings: 1, max_toppings: 2,
  permite_chocolate: true, permite_salsas: true, permite_frutas: false, es_bowl: false, id_categoria: 1, img: 'x', descripcion: null, ...o });

beforeEach(() => {
  jest.clearAllMocks();
  prisma.producto.findMany.mockResolvedValue([prod()]);
  prisma.topping.findMany.mockResolvedValue([
    { id_topping: 10, nombre: 'Oreo', estado: 1 }, { id_topping: 11, nombre: 'Mani', estado: 1 },
    { id_topping: 12, nombre: 'Chips', estado: 1 }, { id_topping: 13, nombre: 'Coco', estado: 0 },
  ]);
  prisma.adicion.findMany.mockResolvedValue([
    { id_adicion: 20, nombre: 'Nutella', precio: '4000', estado: 1 }, { id_adicion: 21, nombre: 'Helado', precio: '3000', estado: 0 },
  ]);
});

const linea = (o) => ({ id_producto: 1, cantidad: 2, toppings: [], adiciones: [], salsas: [], ...o });

test('precio igual a crear(): base + toppings extra (2000) + salsas extra (5000) + adiciones', async () => {
  const { lineas } = await carrito.validar([linea({
    toppings: [{ id_topping: 10, cantidad: 1 }, { id_topping: 11, cantidad: 1 }, { id_topping: 12, cantidad: 1 }], // 1 extra
    salsas: ['a', 'b', 'c'],                                                                                         // 1 extra
    adiciones: [{ id_adicion: 20, cantidad: 2 }],                                                                    // 2 x 4000
  })]);
  expect(lineas[0]).toMatchObject({ disponible: true, cambios: [], cargo_extra: 7000, precio_unitario: 20000 + 7000 + 8000 });
});

test('producto desactivado: la línea queda no disponible', async () => {
  prisma.producto.findMany.mockResolvedValue([prod({ estado: 0 })]);
  const { lineas } = await carrito.validar([linea()]);
  expect(lineas[0].disponible).toBe(false);
  expect(lineas[0].cambios[0]).toMatch(/Fresas con crema ya no está disponible/);
});

test('topping y adición desactivados se quitan y se avisa', async () => {
  const { lineas } = await carrito.validar([linea({ toppings: [{ id_topping: 13, cantidad: 1 }], adiciones: [{ id_adicion: 21, cantidad: 1 }] })]);
  expect(lineas[0].toppings).toEqual([]);
  expect(lineas[0].adiciones).toEqual([]);
  expect(lineas[0].cambios).toEqual([
    'El topping Coco ya no está disponible y se quitó',
    'La adición Helado ya no está disponible y se quitó',
  ]);
});

test('si el producto ya no permite chocolate, se quita la elección', async () => {
  prisma.producto.findMany.mockResolvedValue([prod({ permite_chocolate: false })]);
  const { lineas } = await carrito.validar([linea({ chocolate: 'negro' })]);
  expect(lineas[0].chocolate).toBeNull();
  expect(lineas[0].cambios).toContain('Ya no se puede elegir chocolate en este producto');
});

test('devuelve el precio actual de la base (para detectar cambios de precio)', async () => {
  prisma.producto.findMany.mockResolvedValue([prod({ precio: '25000' })]);
  const { lineas } = await carrito.validar([linea()]);
  expect(lineas[0].producto.precio).toBe(25000);
  expect(lineas[0].precio_unitario).toBe(25000);
});

test('guardar hace upsert por usuario y obtener devuelve [] si no hay carrito', async () => {
  prisma.carritoGuardado.findUnique.mockResolvedValue(null);
  expect(await carrito.obtener(5)).toEqual({ items: [] });
  await carrito.guardar(5, [linea()]);
  expect(prisma.carritoGuardado.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id_usuario: 5 } }));
});
