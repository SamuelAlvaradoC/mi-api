// Regla única para los registros pagos/detalle_pagos de una venta: se derivan
// SIEMPRE de los campos de la venta (metodo_pago, total, monto_efectivo,
// monto_transferencia), que son la fuente de verdad.
//
// Antes esta regla vivía solo dentro de cambiarEstado (al entregar), y editar()
// cambiaba el método/montos de la venta sin tocar el detalle -- así quedaron
// ventas como #109 y #164 (mixtos con un solo detalle por el total).

// Detalle que le corresponde a la venta. `metodos` = filas de metodos_pago.
const detallesEsperados = (venta, metodos, comprobante = null) => {
  const buscar = (nombre) => metodos.find((m) => m.nombre.toLowerCase().includes(nombre));
  const total = Number(venta.total);
  const ef    = Number(venta.monto_efectivo || 0);
  const tr    = Number(venta.monto_transferencia || 0);
  const fila  = (nombre, monto, conComprobante = false) => {
    const m = buscar(nombre);
    return m ? [{ id_metodo_pago: m.id_metodo_pago, nombre: m.nombre, monto, comprobante: conComprobante ? comprobante : null }] : [];
  };
  switch (venta.metodo_pago) {
    case 'efectivo':      return fila('efectivo', total);
    case 'datafono':      return fila('datafono', total);
    case 'transferencia': return fila('transferencia', total, true);
    case 'mixto':         return [
      ...(ef > 0 ? fila('efectivo', ef) : []),
      ...(tr > 0 ? fila('transferencia', tr, true) : []),
    ];
    default:              return [];
  }
};

// Reescribe el detalle del pago de la venta para que coincida con ella.
// `db` es prisma o el cliente de una $transaction. Si la venta todavía no
// tiene pago (no se ha entregado) no crea nada: el pago nace al entregar.
const sincronizarDetallePagos = async (db, venta) => {
  const pago = await db.pago.findFirst({
    where: { id_venta: venta.id_venta },
    include: { detallePagos: true },
  });
  if (!pago) return null;

  // Conservar el comprobante ya guardado si la venta no trae uno propio.
  const comprobante = venta.comprobante_url
    || pago.detallePagos.find((d) => d.comprobante)?.comprobante
    || null;
  const metodos = await db.metodoPago.findMany();
  const filas = detallesEsperados(venta, metodos, comprobante);

  await db.pago.update({ where: { id_pago: pago.id_pago }, data: { total_pagado: venta.total } });
  await db.detallePago.deleteMany({ where: { id_pago: pago.id_pago } });
  for (const f of filas) {
    await db.detallePago.create({
      data: { id_pago: pago.id_pago, id_metodo_pago: f.id_metodo_pago, monto: f.monto, comprobante: f.comprobante },
    });
  }
  return pago.id_pago;
};

module.exports = { detallesEsperados, sincronizarDetallePagos };
