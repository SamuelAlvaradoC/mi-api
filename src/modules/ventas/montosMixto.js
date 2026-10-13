// Regla del pago mixto: efectivo + transferencia debe ser EXACTAMENTE el total
// de la venta (total = subtotal − descuento de puntos + domicilio), igual que
// valida el checkout web. Si no cuadra, cierre de caja, "Ingresos hoy" y
// Métricas (que suman monto_efectivo/monto_transferencia) cuentan plata de más
// o de menos -- por eso se rechaza en la API y no solo en cada frontend.
const validarMontosMixto = (total, montoEfectivo, montoTransferencia) => {
  const ef = Number(montoEfectivo);
  const tr = Number(montoTransferencia);
  const tot = Math.round(Number(total));
  if (!Number.isFinite(ef) || !Number.isFinite(tr) || ef < 0 || tr < 0) {
    throw { status: 400, message: 'En pago mixto los montos de efectivo y transferencia deben ser números mayores o iguales a 0' };
  }
  if (Math.round(ef + tr) !== tot) {
    const fmt = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
    throw {
      status: 400,
      message: `En pago mixto, efectivo (${fmt(ef)}) + transferencia (${fmt(tr)}) = ${fmt(ef + tr)} debe ser igual al total del pedido (${fmt(tot)})`,
    };
  }
};

module.exports = { validarMontosMixto };
