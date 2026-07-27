const prisma = require('../../config/prisma');

const listar = () => prisma.ciudad.findMany({ orderBy: { nombre: 'asc' }, include: { _count: { select: { barrios: true } } } });

const listarActivas = () => prisma.ciudad.findMany({ where: { estado: 1 }, orderBy: { nombre: 'asc' } });

const obtener = async (id) => {
  const c = await prisma.ciudad.findUnique({ where: { id_ciudad: id }, include: { barrios: { orderBy: { nombre: 'asc' } } } });
  if (!c) throw { status: 404, message: 'Ciudad no encontrada' };
  return c;
};

const crear = (datos) => prisma.ciudad.create({ data: { nombre: datos.nombre.trim(), estado: 1 } });

const actualizar = async (id, datos) => {
  await obtener(id);
  return prisma.ciudad.update({ where: { id_ciudad: id }, data: { nombre: datos.nombre.trim() } });
};

const eliminar = async (id) => {
  await obtener(id);
  const enUso = await prisma.barrio.count({ where: { id_ciudad: id } });
  if (enUso > 0) throw { status: 409, message: `No se puede eliminar: tiene ${enUso} barrio(s). Desactívala en su lugar.` };
  return prisma.ciudad.delete({ where: { id_ciudad: id } });
};

const cambiarEstado = async (id, estado) => {
  await obtener(id);
  return prisma.ciudad.update({ where: { id_ciudad: id }, data: { estado: Number(estado) } });
};

module.exports = { listar, listarActivas, obtener, crear, actualizar, eliminar, cambiarEstado };
