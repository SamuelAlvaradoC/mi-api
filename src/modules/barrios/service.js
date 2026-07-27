const prisma = require('../../config/prisma');

const inc = { ciudad: true };

const listar = (id_ciudad) => prisma.barrio.findMany({
  where: id_ciudad ? { id_ciudad: Number(id_ciudad) } : undefined,
  include: inc,
  orderBy: [{ ciudad: { nombre: 'asc' } }, { nombre: 'asc' }],
});

const listarActivos = (id_ciudad) => prisma.barrio.findMany({
  where: { estado: 1, ...(id_ciudad ? { id_ciudad: Number(id_ciudad) } : {}) },
  include: inc,
  orderBy: { nombre: 'asc' },
});

const obtener = async (id) => {
  const b = await prisma.barrio.findUnique({ where: { id_barrio: id }, include: inc });
  if (!b) throw { status: 404, message: 'Barrio no encontrado' };
  return b;
};

const crear = async (datos) => {
  const ciudad = await prisma.ciudad.findUnique({ where: { id_ciudad: Number(datos.id_ciudad) } });
  if (!ciudad) throw { status: 404, message: 'Ciudad no encontrada' };
  return prisma.barrio.create({
    data: {
      nombre:           datos.nombre.trim(),
      id_ciudad:        Number(datos.id_ciudad),
      precio_domicilio: Number(datos.precio_domicilio),
      estado:           1,
    },
    include: inc,
  });
};

const actualizar = async (id, datos) => {
  await obtener(id);
  const updateData = {};
  if (datos.nombre           !== undefined) updateData.nombre           = datos.nombre.trim();
  if (datos.id_ciudad        !== undefined) updateData.id_ciudad        = Number(datos.id_ciudad);
  if (datos.precio_domicilio !== undefined) updateData.precio_domicilio = Number(datos.precio_domicilio);
  return prisma.barrio.update({ where: { id_barrio: id }, data: updateData, include: inc });
};

const eliminar = async (id) => {
  await obtener(id);
  const enUso = await prisma.direccion.count({ where: { id_barrio: id } });
  if (enUso > 0) throw { status: 409, message: `No se puede eliminar: ${enUso} dirección(es) lo usan. Desactívalo en su lugar.` };
  return prisma.barrio.delete({ where: { id_barrio: id } });
};

const cambiarEstado = async (id, estado) => {
  await obtener(id);
  return prisma.barrio.update({ where: { id_barrio: id }, data: { estado: Number(estado) }, include: inc });
};

module.exports = { listar, listarActivos, obtener, crear, actualizar, eliminar, cambiarEstado };
