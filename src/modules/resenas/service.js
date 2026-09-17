const prisma = require('../../config/prisma');

const crear = async (datos) => {
  // Igual que el resto del endpoint (sin auth): confía en el id_venta que
  // manda el cliente, pero valida que exista, esté entregada y no tenga ya
  // una reseña -- así el error es un 400 claro en vez de un 500 crudo por
  // violar el UNIQUE de resenas.id_venta (double-submit del banner, o un
  // id inventado/de otro cliente).
  if (datos.id_venta) {
    const venta = await prisma.venta.findUnique({
      where: { id_venta: datos.id_venta },
      include: { estado: true, resena: true },
    });
    if (!venta) throw { status: 400, message: 'El pedido indicado no existe' };
    if (venta.estado?.nombre_estado !== 'entregado') {
      throw { status: 400, message: 'Solo se puede reseñar un pedido ya entregado' };
    }
    if (venta.resena) {
      throw { status: 400, message: 'Este pedido ya tiene una reseña registrada' };
    }
  }
  return prisma.resena.create({ data: datos });
};

const listar = () => prisma.resena.findMany({
  orderBy: { fecha: 'desc' },
  include: { usuario: { select: { nombre: true, email: true } } },
});

const resumen = async () => {
  const all = await prisma.resena.findMany({ orderBy: { fecha: 'desc' } });
  if (all.length === 0) return { total: 0, promAtencion: 0, promProducto: 0, resenas: [] };
  const promAtencion = all.reduce((s, r) => s + r.calificacion_atencion, 0) / all.length;
  const promProducto = all.reduce((s, r) => s + r.calificacion_producto, 0) / all.length;
  return {
    total: all.length,
    promAtencion: Math.round(promAtencion * 10) / 10,
    promProducto: Math.round(promProducto * 10) / 10,
    resenas: all.slice(0, 10),
  };
};

module.exports = { crear, listar, resumen };
