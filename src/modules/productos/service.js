const prisma = require('../../config/prisma');

const inc = { categoria: true };

const listar = () => prisma.producto.findMany({ include: inc, orderBy: { nombre: 'asc' } });

const buscar = (q) => prisma.producto.findMany({
  where: { nombre: { contains: q, mode: 'insensitive' } },
  include: inc,
});

const filtrar = (categoriaId) => prisma.producto.findMany({
  where: { id_categoria: Number(categoriaId) },
  include: inc,
});

const obtener = async (id) => {
  const p = await prisma.producto.findUnique({
    where: { id_producto: id },
    include: { categoria: true },
  });
  if (!p) throw { status: 404, message: 'Producto no encontrado' };
  return p;
};

const crear = (datos) => prisma.producto.create({
  data: {
    ...datos,
    estado: 1,
    permite_chocolate: datos.permite_chocolate ? true : false,
  },
  include: inc,
});

const actualizar = async (id, datos) => {
  await obtener(id);
  const data = { ...datos };
  if (data.permite_chocolate !== undefined) data.permite_chocolate = data.permite_chocolate ? true : false;
  return prisma.producto.update({ where: { id_producto: id }, data, include: inc });
};

const eliminar = async (id) => {
  await obtener(id);
  const enUso = await prisma.detalleVenta.count({ where: { id_producto: id } });
  if (enUso > 0) throw { status: 409, message: `No se puede eliminar: tiene ${enUso} venta(s) asociada(s). Desactívalo en su lugar.` };
  return prisma.producto.delete({ where: { id_producto: id } });
};

const cambiarEstado = async (id, estado) => {
  await obtener(id);
  return prisma.producto.update({ where: { id_producto: id }, data: { estado }, include: inc });
};

module.exports = { listar, buscar, filtrar, obtener, crear, actualizar, eliminar, cambiarEstado };
