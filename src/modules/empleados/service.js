const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');

const incUsuario = { usuario: { select: { nombre: true, email: true, rol: true } } };

const listar = () => prisma.empleado.findMany({ where: { estado: 1 }, include: incUsuario });

const buscar = (q) => prisma.empleado.findMany({
  where: {
    OR: [
      { cargo: { contains: q, mode: 'insensitive' } },
      { usuario: { nombre: { contains: q, mode: 'insensitive' } } },
    ],
  },
  include: incUsuario,
});

const obtener = async (id) => {
  const e = await prisma.empleado.findUnique({ where: { id_empleado: id }, include: incUsuario });
  if (!e) throw { status: 404, message: 'Empleado no encontrado' };
  return e;
};

const ROL_POR_CARGO = { 'Domiciliario': 2, 'Cocinero': 5, 'Confirmador': 3 };

const crear = async ({ nombre, email, contrasena, id_rol, cargo, fecha_ingreso }) => {
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) throw { status: 409, message: 'El email ya está registrado' };
  const hash   = await bcrypt.hash(contrasena, 10);
  const rolFinal = id_rol || ROL_POR_CARGO[cargo] || 2;
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: { nombre, email, contrasena: hash, id_rol: rolFinal, estado: 1 },
    });
    return tx.empleado.create({
      data: { id_usuario: usuario.id_usuario, cargo, fecha_ingreso: new Date(fecha_ingreso), estado: 1 },
      include: incUsuario,
    });
  });
};

const actualizar = async (id, datos) => {
  await obtener(id);
  return prisma.empleado.update({ where: { id_empleado: id }, data: datos, include: incUsuario });
};

const eliminar = async (id) => {
  const emp = await obtener(id);
  // Bloquear eliminación de administradores
  const usuario = await prisma.usuario.findUnique({ where: { id_usuario: emp.id_usuario }, include: { rol: true } });
  if (usuario?.rol?.nombre === 'admin') throw { status: 403, message: 'No se puede eliminar un empleado con rol Administrador' };
  const domiciliosCount = await prisma.ventaDomiciliario.count({ where: { id_empleado: emp.id_empleado } }).catch(() => 0);
  if (domiciliosCount > 0) throw { status: 409, message: `No se puede eliminar: el empleado tiene ${domiciliosCount} domicilio(s) asignado(s)` };
  return prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id_usuario: emp.id_usuario }, data: { estado: 0 } });
    return tx.empleado.update({ where: { id_empleado: id }, data: { estado: 0 }, include: incUsuario });
  });
};

const cambiarEstado = async (id, estado) => {
  await obtener(id);
  return prisma.empleado.update({ where: { id_empleado: id }, data: { estado }, include: incUsuario });
};

module.exports = { listar, buscar, obtener, crear, actualizar, eliminar, cambiarEstado };
