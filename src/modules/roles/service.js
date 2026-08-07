const prisma = require('../../config/prisma');

const listar = () => prisma.rol.findMany({
  include: { rolPermisos: { include: { permiso: true } } },
});

const obtener = async (id) => {
  const rol = await prisma.rol.findUnique({
    where: { id_rol: id },
    include: { rolPermisos: { include: { permiso: true } } },
  });
  if (!rol) throw { status: 404, message: 'Rol no encontrado' };
  return rol;
};

const crear = (datos) => prisma.rol.create({ data: datos });

const actualizar = async (id, datos) => {
  const rol = await prisma.rol.findUnique({ where: { id_rol: id } });
  if (!rol) throw { status: 404, message: 'Rol no encontrado' };
  return prisma.rol.update({ where: { id_rol: id }, data: datos });
};

const eliminar = async (id) => {
  const rol = await prisma.rol.findUnique({ where: { id_rol: id } });
  if (!rol) throw { status: 404, message: 'Rol no encontrado' };
  const enUso = await prisma.usuario.count({ where: { id_rol: id } });
  if (enUso > 0) throw { status: 409, message: 'No se puede eliminar un rol asignado a usuarios' };
  await prisma.rolPermiso.deleteMany({ where: { id_rol: id } });
  return prisma.rol.delete({ where: { id_rol: id } });
};

const asignarPermisos = async (id, permisos) => {
  const rol = await prisma.rol.findUnique({ where: { id_rol: id } });
  if (!rol) throw { status: 404, message: 'Rol no encontrado' };
  await prisma.rolPermiso.deleteMany({ where: { id_rol: id } });
  await prisma.rolPermiso.createMany({
    data: permisos.map((id_permiso) => ({ id_rol: id, id_permiso })),
  });
  return prisma.rol.findUnique({
    where: { id_rol: id },
    include: { rolPermisos: { include: { permiso: true } } },
  });
};

const listarPermisos = () => prisma.permiso.findMany({ orderBy: { nombre: 'asc' } });

const activarDesactivar = async (id) => {
  const rol = await prisma.rol.findUnique({ where: { id_rol: id } });
  if (!rol) throw { status: 404, message: 'Rol no encontrado' };
  return prisma.rol.update({
    where: { id_rol: id },
    data: { estado: rol.estado ? 0 : 1 },
    include: { rolPermisos: { include: { permiso: true } } },
  });
};

module.exports = { listar, obtener, crear, actualizar, eliminar, asignarPermisos, listarPermisos, activarDesactivar };