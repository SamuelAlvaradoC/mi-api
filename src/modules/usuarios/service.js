const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');
const { eliminarPorUsuario } = require('../../utils/eliminarCuentaCascada');
const logger = require('../../utils/logger');
const { sincronizarPerfilPorRol, ROLES_EMPLEADO_CON_PERFIL, CARGO_MAP } = require('../../utils/sincronizarPerfilPorRol');

const select = {
  id_usuario: true, id_rol: true, nombre: true,
  email: true, estado: true, fecha_registro: true, rol: true,
};

const listar = () => prisma.usuario.findMany({
  include: { rol: true, cliente: true, empleado: true },
  orderBy: { fecha_registro: 'desc' },
});

const buscar = (q) => prisma.usuario.findMany({
  where: { OR: [{ nombre: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] },
  select,
});

const obtener = async (id) => {
  const u = await prisma.usuario.findUnique({ where: { id_usuario: id }, select });
  if (!u) throw { status: 404, message: 'Usuario no encontrado' };
  return u;
};

const SUPER_ADMIN_ID = 1;

const crear = async ({ telefono, ...datos }) => {
  const existe = await prisma.usuario.findUnique({ where: { email: datos.email } });
  if (existe) throw { status: 409, message: 'El email ya está registrado' };
  const hash = await bcrypt.hash(datos.contrasena, 10);

  // Obtener nombre del rol para decidir qué perfil crear
  const rol = datos.id_rol ? await prisma.rol.findUnique({ where: { id_rol: datos.id_rol } }) : null;
  const rolNombre = rol?.nombre || '';

  // telefono se saca de `datos` porque Usuario no tiene esa columna (solo
  // Cliente) — se usa más abajo únicamente si el rol resulta ser 'cliente'.
  const usuario = await prisma.usuario.create({ data: { ...datos, contrasena: hash }, select });

  // Auto-crear perfil vinculado según el rol (admin es excepción -- ver
  // sincronizarPerfilPorRol.js -- no recibe registro Empleado).
  try {
    if (ROLES_EMPLEADO_CON_PERFIL.includes(rolNombre)) {
      const yaExiste = await prisma.empleado.findFirst({ where: { id_usuario: usuario.id_usuario } });
      if (!yaExiste) {
        await prisma.empleado.create({
          data: { id_usuario: usuario.id_usuario, cargo: CARGO_MAP[rolNombre], fecha_ingreso: new Date(), estado: 1 },
        });
      }
    } else if (rolNombre === 'cliente') {
      const yaExiste = await prisma.cliente.findFirst({ where: { id_usuario: usuario.id_usuario } });
      if (!yaExiste) {
        await prisma.cliente.create({ data: { id_usuario: usuario.id_usuario, telefono: telefono || null, estado: 1 } });
      }
    }
  } catch (perfErr) {
    logger.error('Error creando perfil vinculado', {
      error: perfErr.message, stack: perfErr.stack,
      id_usuario: usuario.id_usuario, rol: rolNombre,
    });
  }

  return usuario;
};

const actualizar = async (id, datos) => {
  await obtener(id);
  if (id === SUPER_ADMIN_ID && datos.id_rol !== undefined) {
    throw { status: 403, message: 'No se puede cambiar el rol del Super Admin' };
  }
  if (datos.contrasena) {
    datos.contrasena = await bcrypt.hash(datos.contrasena, 10);
    datos.tiene_contrasena = true; // también si era una cuenta solo de Google
  }
  // Todo en una transacción: si falla la sincronización de Empleado/Cliente,
  // el cambio de rol en Usuario tampoco debe quedar aplicado a medias.
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.update({ where: { id_usuario: id }, data: datos, select });
    if (datos.id_rol !== undefined) {
      await sincronizarPerfilPorRol(tx, id, usuario.rol?.nombre);
    }
    return usuario;
  });
};

const eliminar = async (id) => {
  if (id === SUPER_ADMIN_ID) throw { status: 403, message: 'No se puede eliminar al Super Admin' };
  await obtener(id);
  await eliminarPorUsuario(id);
};

const activarDesactivar = async (id, estado) => {
  if (id === SUPER_ADMIN_ID) throw { status: 403, message: 'No se puede cambiar el estado del Super Admin' };
  await obtener(id);
  const nuevoEstado = Number(estado);
  return prisma.$transaction(async (tx) => {
    try { await tx.empleado.updateMany({ where: { id_usuario: id }, data: { estado: nuevoEstado } }); } catch (_) {}
    try { await tx.cliente.updateMany({ where: { id_usuario: id }, data: { estado: nuevoEstado } }); } catch (_) {}
    return tx.usuario.update({ where: { id_usuario: id }, data: { estado: nuevoEstado }, select });
  });
};

const asignarRol = async (id, id_rol) => {
  if (id === SUPER_ADMIN_ID) throw { status: 403, message: 'No se puede cambiar el rol del Super Admin' };
  await obtener(id);
  const rol = await prisma.rol.findUnique({ where: { id_rol } });
  if (!rol) throw { status: 404, message: 'Rol no encontrado' };
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.update({ where: { id_usuario: id }, data: { id_rol }, select });
    await sincronizarPerfilPorRol(tx, id, rol.nombre);
    return usuario;
  });
};

module.exports = { listar, buscar, obtener, crear, actualizar, eliminar, activarDesactivar, asignarRol };
