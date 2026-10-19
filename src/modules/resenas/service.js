const prisma = require('../../config/prisma');

const crear = async (datos) => {
  // Sin id_venta es la encuesta general (pública). Con id_venta, solo el
  // cliente dueño de ese pedido puede reseñarlo (antes cualquiera podía
  // reseñar un pedido ajeno y bloquear la reseña del cliente real). Además
  // debe estar entregado y sin reseña -- un 400 claro en vez de un 500 por
  // el UNIQUE de resenas.id_venta.
  if (datos.id_venta) {
    if (!datos.id_usuario) throw { status: 401, message: 'Inicia sesión para reseñar tu pedido' };
    const venta = await prisma.venta.findUnique({
      where: { id_venta: datos.id_venta },
      include: { estado: true, resena: true, cliente: { select: { id_usuario: true } } },
    });
    if (!venta) throw { status: 400, message: 'El pedido indicado no existe' };
    if (venta.cliente?.id_usuario !== datos.id_usuario) {
      throw { status: 403, message: 'Solo puedes reseñar tus propios pedidos' };
    }
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
