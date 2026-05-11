const prisma = require('../../config/prisma');

const crear = (datos) => prisma.resena.create({ data: datos });

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
