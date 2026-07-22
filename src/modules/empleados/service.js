const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');

const incUsuario = { usuario: { select: { nombre: true, email: true, estado: true, fecha_registro: true, rol: true } } };

const listar = () => prisma.empleado.findMany({ include: incUsuario });

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
  const emp = await obtener(id);
  const { nombre, email, estado, contrasena, ...empRest } = datos;
  const usuarioDatos = {};
  if (nombre !== undefined) usuarioDatos.nombre = nombre;
  if (email  !== undefined) usuarioDatos.email  = email;
  if (estado !== undefined) usuarioDatos.estado = estado;
  const empDatos = { ...empRest };
  if (estado !== undefined) empDatos.estado = estado;
  if (empDatos.fecha_ingreso) empDatos.fecha_ingreso = new Date(empDatos.fecha_ingreso);
  // Sincronizar id_rol en Usuario cuando cambia el cargo
  if (empDatos.cargo && ROL_POR_CARGO[empDatos.cargo]) {
    usuarioDatos.id_rol = ROL_POR_CARGO[empDatos.cargo];
  }
  await prisma.$transaction(async (tx) => {
    if (Object.keys(usuarioDatos).length > 0) {
      await tx.usuario.update({ where: { id_usuario: emp.id_usuario }, data: usuarioDatos });
    }
    if (Object.keys(empDatos).length > 0) {
      await tx.empleado.update({ where: { id_empleado: id }, data: empDatos });
    }
  });
  return obtener(id);
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
  const emp = await obtener(id);
  return prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id_usuario: emp.id_usuario }, data: { estado } });
    return tx.empleado.update({ where: { id_empleado: id }, data: { estado }, include: incUsuario });
  });
};

module.exports = { listar, buscar, obtener, crear, actualizar, eliminar, cambiarEstado };
