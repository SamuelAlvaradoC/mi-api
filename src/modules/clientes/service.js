const prisma = require('../../config/prisma');

const incUsuario = { usuario: { select: { nombre: true, email: true, estado: true } } };

const listar = () => prisma.cliente.findMany({ where: { estado: 1 }, include: incUsuario });

const crear = async ({ nombre, email, contrasena, telefono }) => {
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) throw { status: 409, message: 'El email ya está registrado' };
  const bcrypt = require('bcryptjs');
  const hash   = await bcrypt.hash(contrasena, 10);
  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: { nombre, email, contrasena: hash, id_rol: 4, estado: 1 },
    });
    const cliente = await tx.cliente.create({
      data: { id_usuario: usuario.id_usuario, telefono: telefono || null },
      include: incUsuario,
    });
    await tx.puntosCliente.create({ data: { id_cliente: cliente.id_cliente, puntos: 0 } });
    return cliente;
  });
};

const buscar = (q) => prisma.cliente.findMany({
  where: {
    OR: [
      { usuario: { nombre: { contains: q, mode: 'insensitive' } } },
      { usuario: { email:  { contains: q, mode: 'insensitive' } } },
      { telefono: { contains: q, mode: 'insensitive' } },
    ],
  },
  include: incUsuario,
});

const obtener = async (id) => {
  const c = await prisma.cliente.findUnique({ where: { id_cliente: id }, include: incUsuario });
  if (!c) throw { status: 404, message: 'Cliente no encontrado' };
  return c;
};

const actualizar = async (id, datos) => {
  await obtener(id);
  return prisma.cliente.update({ where: { id_cliente: id }, data: datos, include: incUsuario });
};

const eliminar = async (id) => {
  const cliente = await obtener(id);
  const ventasCount = await prisma.venta.count({ where: { id_cliente: id } });
  if (ventasCount > 0) throw { status: 409, message: `No se puede eliminar: el cliente tiene ${ventasCount} venta(s) registrada(s)` };
  // Soft-delete en cascada: usuario + cliente
  return prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id_usuario: cliente.id_usuario }, data: { estado: 0 } });
    return tx.cliente.update({ where: { id_cliente: id }, data: { estado: 0 } });
  });
};

const cambiarEstado = async (id, estado) => {
  const c = await obtener(id);
  return prisma.$transaction(async (tx) => {
    await tx.cliente.update({ where: { id_cliente: id }, data: { estado } });
    return tx.usuario.update({
      where: { id_usuario: c.id_usuario },
      data: { estado },
      select: { id_usuario: true, nombre: true, email: true, estado: true },
    });
  });
};

const historialPedidos = async (id) => {
  await obtener(id);
  return prisma.venta.findMany({
    where: { id_cliente: id },
    include: {
      estado: true,
      detalleVentas: { include: { producto: true } },
    },
    orderBy: { fecha: 'desc' },
  });
};

const toppingsFavoritos = async (id) => {
  await obtener(id);
  const agrupados = await prisma.detalleTopping.groupBy({
    by: ['id_topping'],
    where: { detalleVenta: { venta: { id_cliente: id } } },
    _count: { id_topping: true },
    orderBy: { _count: { id_topping: 'desc' } },
    take: 5,
  });
  const ids = agrupados.map((r) => r.id_topping);
  const toppings = await prisma.topping.findMany({ where: { id_topping: { in: ids } } });
  const map = Object.fromEntries(toppings.map((t) => [t.id_topping, t]));
  return agrupados.map((r) => ({ topping: map[r.id_topping], veces_pedido: r._count.id_topping }));
};

const adicionesFavoritas = async (id) => {
  await obtener(id);
  const agrupados = await prisma.detalleAdicion.groupBy({
    by: ['id_adicion'],
    where: { detalleVenta: { venta: { id_cliente: id } } },
    _sum: { cantidad: true },
    orderBy: { _sum: { cantidad: 'desc' } },
    take: 5,
  });
  const ids = agrupados.map((r) => r.id_adicion);
  const adiciones = await prisma.adicion.findMany({ where: { id_adicion: { in: ids } } });
  const map = Object.fromEntries(adiciones.map((a) => [a.id_adicion, a]));
  return agrupados.map((r) => ({ adicion: map[r.id_adicion], cantidad_total: r._sum.cantidad }));
};

const perfil = async (id) => {
  const c = await prisma.cliente.findUnique({
    where: { id_cliente: id },
    include: {
      usuario: { select: { nombre: true, email: true, estado: true, fecha_registro: true, rol: true } },
      direcciones: true,
    },
  });
  if (!c) throw { status: 404, message: 'Cliente no encontrado' };
  return c;
};

const listarDirecciones = async (id) => { await obtener(id); return prisma.direccion.findMany({ where: { id_cliente: id } }); };
const crearDireccion    = async (id, datos) => { await obtener(id); return prisma.direccion.create({ data: { ...datos, id_cliente: id, estado: 1 } }); };

module.exports = { listar, crear, buscar, obtener, actualizar, eliminar, cambiarEstado,
  historialPedidos, toppingsFavoritos, adicionesFavoritas, perfil, listarDirecciones, crearDireccion };
