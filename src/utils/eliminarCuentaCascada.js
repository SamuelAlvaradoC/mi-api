const prisma = require('../config/prisma');

// Borrado permanente de una cuenta (usuario + cliente/empleado vinculados).
// Bloquea si hay historial real de negocio (ventas, domicilios, pagos, cierres
// de caja) para no perder datos ni violar llaves foráneas; si no hay historial,
// borra en cascada todo lo dependiente y luego la(s) fila(s) de verdad.
const eliminarPorUsuario = async (id_usuario) => {
  const cliente  = await prisma.cliente.findUnique({ where: { id_usuario } });
  const empleado = await prisma.empleado.findUnique({ where: { id_usuario } });

  if (cliente) {
    const ventasCount = await prisma.venta.count({ where: { id_cliente: cliente.id_cliente } });
    if (ventasCount > 0) throw { status: 409, message: `No se puede eliminar: el usuario tiene ${ventasCount} venta(s) registrada(s)` };
  }
  if (empleado) {
    const domiciliosCount = await prisma.ventaDomiciliario.count({ where: { id_empleado: empleado.id_empleado } });
    if (domiciliosCount > 0) throw { status: 409, message: `No se puede eliminar: el empleado tiene ${domiciliosCount} domicilio(s) asignado(s)` };
    const pagosCount = await prisma.pago.count({ where: { id_empleado: empleado.id_empleado } });
    if (pagosCount > 0) throw { status: 409, message: `No se puede eliminar: el empleado tiene ${pagosCount} pago(s) registrado(s)` };
  }
  const cierresCount = await prisma.cierreCaja.count({ where: { creado_por: id_usuario } });
  if (cierresCount > 0) throw { status: 409, message: `No se puede eliminar: el usuario registró ${cierresCount} cierre(s) de caja` };

  return prisma.$transaction(async (tx) => {
    if (cliente) {
      const puntos = await tx.puntosCliente.findUnique({ where: { id_cliente: cliente.id_cliente } });
      if (puntos) {
        await tx.movimientoPuntos.deleteMany({ where: { id_puntos: puntos.id_puntos } });
        await tx.puntosCliente.delete({ where: { id_puntos: puntos.id_puntos } });
      }
      await tx.direccion.deleteMany({ where: { id_cliente: cliente.id_cliente } });
    }
    // Las reseñas se conservan (contenido real de negocio); solo se desvinculan de la cuenta borrada
    await tx.resena.updateMany({ where: { id_usuario }, data: { id_usuario: null } });

    if (empleado) await tx.empleado.delete({ where: { id_empleado: empleado.id_empleado } });
    if (cliente)  await tx.cliente.delete({ where: { id_cliente: cliente.id_cliente } });
    await tx.usuario.delete({ where: { id_usuario } });
  });
};

module.exports = { eliminarPorUsuario };
