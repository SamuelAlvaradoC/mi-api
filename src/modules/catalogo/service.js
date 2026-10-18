const prisma = require('../../config/prisma');

// ── Catálogo (público, sin auth) ────────────────────────

const listarProductos = () => prisma.producto.findMany({
  where: { estado: 1 },
  include: { categoria: true },
  orderBy: { nombre: 'asc' },
});

const obtenerProducto = async (id) => {
  const p = await prisma.producto.findUnique({
    where: { id_producto: id, estado: 1 },
    include: {
      categoria: true,
      // toppings disponibles (todos activos, no filtrados por producto aquí)
    },
  });
  if (!p) throw { status: 404, message: 'Producto no disponible' };

  // Obtener toppings y adiciones disponibles
  const toppings  = p.permite_toppings ? await prisma.topping.findMany({ where: { estado: 1 } }) : [];
  const adiciones = await prisma.adicion.findMany({ where: { estado: 1 } });

  return { ...p, toppings_disponibles: toppings, adiciones_disponibles: adiciones };
};

const listarCategorias = () => prisma.categoria.findMany({ where: { estado: 1 }, orderBy: { nombre: 'asc' } });

const buscar = (q) => prisma.producto.findMany({
  where: {
    estado: 1,
    OR: [
      { nombre:       { contains: q, mode: 'insensitive' } },
      { descripcion:  { contains: q, mode: 'insensitive' } },
    ],
  },
  include: { categoria: true },
});

const promociones = async () => {
  // Top 6 productos más vendidos como "promociones"
  const agrupados = await prisma.detalleVenta.groupBy({
    by: ['id_producto'],
    _sum: { cantidad: true },
    orderBy: { _sum: { cantidad: 'desc' } },
    take: 6,
  });
  const ids = agrupados.map((r) => r.id_producto);
  return prisma.producto.findMany({ where: { id_producto: { in: ids }, estado: 1 }, include: { categoria: true } });
};

// Top 6 productos con más unidades vendidas en pedidos entregados (todo el
// histórico, mismo criterio que el dashboard admin) — solo productos activos.
// Se agrupa sin límite y se recorta a 6 después de filtrar inactivos, para
// no perder puestos por productos desactivados que quedaron en medio del ranking.
const masPedidos = async () => {
  const agrupados = await prisma.detalleVenta.groupBy({
    by: ['id_producto'],
    where: { venta: { estado: { nombre_estado: 'entregado' } } },
    _sum: { cantidad: true },
    orderBy: { _sum: { cantidad: 'desc' } },
  });
  if (agrupados.length === 0) return [];

  const ids = agrupados.map((r) => r.id_producto);
  const productos = await prisma.producto.findMany({
    where: { id_producto: { in: ids }, estado: 1 },
    include: { categoria: true },
  });
  const porId = new Map(productos.map((p) => [p.id_producto, p]));

  return agrupados.map((r) => porId.get(r.id_producto)).filter(Boolean).slice(0, 6);
};

const listarToppingsActivos  = () => prisma.topping.findMany({ where: { estado: 1 }, orderBy: { nombre: 'asc' } });
const listarAdicionesActivas = () => prisma.adicion.findMany({ where: { estado: 1 }, orderBy: { nombre: 'asc' } });

module.exports = {
  listarProductos, obtenerProducto, listarCategorias, buscar, promociones, masPedidos,
  listarToppingsActivos, listarAdicionesActivas,
};
