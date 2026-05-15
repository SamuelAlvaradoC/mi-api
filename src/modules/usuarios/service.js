const bcrypt = require('bcryptjs');
const prisma = require('../../config/prisma');

const select = {
  id_usuario: true, id_rol: true, nombre: true,
  email: true, estado: true, fecha_registro: true, rol: true,
};

const listar = () => prisma.usuario.findMany({
  where: { estado: 1 },
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

const ROLES_EMPLEADO = ['domiciliario', 'cocinero', 'confirmador_domicilio', 'admin'];
const CARGO_MAP      = { domiciliario: 'Domiciliario', cocinero: 'Cocinero', confirmador_domicilio: 'Confirmador', admin: 'Administrador' };

const crear = async (datos) => {
  const existe = await prisma.usuario.findUnique({ where: { email: datos.email } });
  if (existe) throw { status: 409, message: 'El email ya está registrado' };
  const hash = await bcrypt.hash(datos.contrasena, 10);

  // Obtener nombre del rol para decidir qué perfil crear
  const rol = datos.id_rol ? await prisma.rol.findUnique({ where: { id_rol: datos.id_rol } }) : null;
  const rolNombre = rol?.nombre || '';

  const usuario = await prisma.usuario.create({ data: { ...datos, contrasena: hash }, select });

  // Auto-crear perfil vinculado según el rol
  try {
    if (ROLES_EMPLEADO.includes(rolNombre)) {
      const yaExiste = await prisma.empleado.findFirst({ where: { id_usuario: usuario.id_usuario } });
      if (!yaExiste) {
        await prisma.empleado.create({
          data: { id_usuario: usuario.id_usuario, cargo: CARGO_MAP[rolNombre] || 'Empleado', fecha_ingreso: new Date(), estado: 1 },
        });
      }
    } else if (rolNombre === 'cliente') {
      const yaExiste = await prisma.cliente.findFirst({ where: { id_usuario: usuario.id_usuario } });
      if (!yaExiste) {
        await prisma.cliente.create({ data: { id_usuario: usuario.id_usuario, telefono: datos.telefono || null, estado: 1 } });
      }
    }
  } catch (perfErr) {
    console.error('Error creando perfil vinculado:', perfErr.message);
  }

  return usuario;
};

const actualizar = async (id, datos) => {
  await obtener(id);
  if (datos.contrasena) datos.contrasena = await bcrypt.hash(datos.contrasena, 10);
  return prisma.usuario.update({ where: { id_usuario: id }, data: datos, select });
};

const eliminar = async (id) => {
  const u = await obtener(id);
  // Bloquear eliminación de administradores
  const rol = await prisma.rol.findUnique({ where: { id_rol: u.id_rol } });
  if (rol?.nombre === 'admin') throw { status: 403, message: 'No se puede eliminar un usuario con rol Administrador' };
  // Verificar ventas via cliente
  const cliente = await prisma.cliente.findUnique({ where: { id_usuario: id } });
  if (cliente) {
    const ventasCount = await prisma.venta.count({ where: { id_cliente: cliente.id_cliente } });
    if (ventasCount > 0) throw { status: 409, message: `No se puede eliminar: el usuario tiene ${ventasCount} venta(s) registrada(s)` };
  }
  // Soft-delete en cascada: usuario + empleado vinculado + cliente vinculado
  return prisma.$transaction(async (tx) => {
    try { await tx.empleado.updateMany({ where: { id_usuario: id }, data: { estado: 0 } }); } catch (_) {}
    try { await tx.cliente.updateMany({ where: { id_usuario: id }, data: { estado: 0 } }); } catch (_) {}
    return tx.usuario.update({ where: { id_usuario: id }, data: { estado: 0 }, select });
  });
};

const activarDesactivar = async (id) => {
  const u     = await obtener(id);
  const nuevo = u.estado ? 0 : 1;
  return prisma.$transaction(async (tx) => {
    try { await tx.empleado.updateMany({ where: { id_usuario: id }, data: { estado: nuevo } }); } catch (_) {}
    try { await tx.cliente.updateMany({ where: { id_usuario: id }, data: { estado: nuevo } }); } catch (_) {}
    return tx.usuario.update({ where: { id_usuario: id }, data: { estado: nuevo }, select });
  });
};

const asignarRol = async (id, id_rol) => {
  await obtener(id);
  const rol = await prisma.rol.findUnique({ where: { id_rol } });
  if (!rol) throw { status: 404, message: 'Rol no encontrado' };
  return prisma.usuario.update({ where: { id_usuario: id }, data: { id_rol }, select });
};

module.exports = { listar, buscar, obtener, crear, actualizar, eliminar, activarDesactivar, asignarRol };
