const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { eliminarPorUsuario } = require('../../utils/eliminarCuentaCascada');

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

const CARGO_A_ROL = { 'Domiciliario': 'domiciliario', 'Cocinero': 'cocinero', 'Confirmador': 'confirmador_domicilio', 'Administrador': 'admin' };

const crear = async ({ nombre, email, contrasena, id_rol, cargo, fecha_ingreso }) => {
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) throw { status: 409, message: 'El email ya está registrado' };
  const hash   = await bcrypt.hash(contrasena, 10);
  let rolFinal = id_rol;
  if (!rolFinal && cargo && CARGO_A_ROL[cargo]) {
    const rolObj = await prisma.rol.findFirst({ where: { nombre: CARGO_A_ROL[cargo] } });
    if (!rolObj) {
      // Antes esto caía en un default silencioso a id_rol=2 (domiciliario),
      // asignando el rol equivocado sin avisar — p.ej. un empleado con cargo
      // "Cocinero" terminaba creado como domiciliario si el rol "cocinero"
      // no existía todavía en Roles.
      throw { status: 422, message: `El rol "${CARGO_A_ROL[cargo]}" no existe. Créalo desde Configuración → Roles antes de asignar el cargo "${cargo}".` };
    }
    rolFinal = rolObj.id_rol;
  }
  if (!rolFinal) throw { status: 422, message: 'No se pudo determinar el rol del empleado. Indica un cargo válido.' };
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
  if (empDatos.cargo && CARGO_A_ROL[empDatos.cargo]) {
    const rolObj = await prisma.rol.findFirst({ where: { nombre: CARGO_A_ROL[empDatos.cargo] } });
    if (!rolObj) {
      throw { status: 422, message: `El rol "${CARGO_A_ROL[empDatos.cargo]}" no existe. Créalo desde Configuración → Roles antes de asignar el cargo "${empDatos.cargo}".` };
    }
    usuarioDatos.id_rol = rolObj.id_rol;
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
  await eliminarPorUsuario(emp.id_usuario);
};

const cambiarEstado = async (id, estado) => {
  const emp = await obtener(id);
  return prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id_usuario: emp.id_usuario }, data: { estado } });
    return tx.empleado.update({ where: { id_empleado: id }, data: { estado }, include: incUsuario });
  });
};

module.exports = { listar, buscar, obtener, crear, actualizar, eliminar, cambiarEstado };
