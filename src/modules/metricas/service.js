const prisma = require('../../config/prisma');
const { ventasPorMes } = require('../dashboard/service');

// Rango del mes actual en hora Colombia (mismo criterio que el resto del
// dashboard: día calendario colombiano empieza a las 05:00 UTC).
const rangoMesActual = () => {
  const ahoraCO = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const inicio  = new Date(Date.UTC(ahoraCO.getUTCFullYear(), ahoraCO.getUTCMonth(), 1, 5, 0, 0));
  const fin     = new Date(Date.UTC(ahoraCO.getUTCFullYear(), ahoraCO.getUTCMonth() + 1, 1, 5, 0, 0));
  return { inicio, fin, mesActual: ahoraCO.getUTCMonth() + 1 };
};

// ── Resumen: clientes registrados, puntos redimidos del mes, ventas netas
//    del mes, promedio mensual, desglose por método de pago del mes ──
const resumen = async () => {
  const { inicio, fin, mesActual } = rangoMesActual();

  const [clientesRegistrados, estadoEntregado, mesesNetas] = await Promise.all([
    prisma.usuario.count({ where: { estado: 1 } }),
    prisma.estado.findFirst({ where: { nombre_estado: 'entregado' } }),
    ventasPorMes(),
  ]);

  // Puntos redimidos del mes: suma de puntos_usados en ventas no anuladas
  // creadas este mes (el descuento se aplica al momento de crear la venta,
  // no al entregarla -- ver auth/service.js puntos).
  const ventasConPuntos = await prisma.venta.findMany({
    where: {
      fecha: { gte: inicio, lt: fin },
      estado: { nombre_estado: { not: 'anulado' } },
      puntos_usados: { gt: 0 },
    },
    select: { puntos_usados: true },
  });
  const puntosRedimidosMes = ventasConPuntos.reduce((s, v) => s + (v.puntos_usados || 0), 0);

  // Desglose por método de pago del mes -- solo ventas entregadas, mismo
  // criterio que el resto del dashboard (pendientes no son ingreso real aún).
  const ventasMes = await prisma.venta.findMany({
    where: { fecha: { gte: inicio, lt: fin }, id_estado: estadoEntregado?.id_estado },
    select: { metodo_pago: true, total: true, costo_domicilio: true, monto_efectivo: true, monto_transferencia: true },
  });

  const montoNetoVenta = (v) => {
    const ef = Number(v.monto_efectivo || 0);
    const tr = Number(v.monto_transferencia || 0);
    const dom = Number(v.costo_domicilio || 0);
    return (ef + tr > 0) ? (ef + tr - dom) : (Number(v.total) - dom);
  };

  const desgloseMap = { efectivo: 0, transferencia: 0, datafono: 0 };
  ventasMes.forEach((v) => {
    const metodo = v.metodo_pago;
    // "mixto" reparte su neto en efectivo/transferencia según los montos
    // reales guardados -- no tiene sentido como bucket propio en este desglose.
    if (metodo === 'mixto') {
      const ef  = Number(v.monto_efectivo || 0);
      const tr  = Number(v.monto_transferencia || 0);
      const dom = Number(v.costo_domicilio || 0);
      const totalBruto = ef + tr;
      if (totalBruto > 0) {
        desgloseMap.efectivo      += (ef / totalBruto) * (totalBruto - dom);
        desgloseMap.transferencia += (tr / totalBruto) * (totalBruto - dom);
      }
      return;
    }
    if (desgloseMap[metodo] !== undefined) {
      desgloseMap[metodo] += montoNetoVenta(v);
    }
  });

  const totalDesglose = desgloseMap.efectivo + desgloseMap.transferencia + desgloseMap.datafono;
  const desglosePago = ['efectivo', 'transferencia', 'datafono'].map((metodo) => ({
    metodo,
    monto: Math.round(desgloseMap[metodo]),
    porcentaje: totalDesglose > 0 ? Math.round((desgloseMap[metodo] / totalDesglose) * 1000) / 10 : 0,
  }));

  // Promedio mensual: solo sobre los meses ya transcurridos del año (incluye
  // el actual) -- promediar contra meses futuros en 0 hundiría el número sin
  // razón.
  const mesesTranscurridos = mesesNetas.slice(0, mesActual);
  const promedioMensual = mesesTranscurridos.length > 0
    ? mesesTranscurridos.reduce((s, m) => s + m.total, 0) / mesesTranscurridos.length
    : 0;

  const ventasNetasMes = mesesNetas.find((m) => m.mes === mesActual)?.total || 0;

  return {
    clientes_registrados: clientesRegistrados,
    puntos_redimidos_mes: puntosRedimidosMes,
    ventas_netas_mes:     Math.round(ventasNetasMes),
    promedio_mensual:     Math.round(promedioMensual),
    desglose_pago:        desglosePago,
  };
};

// ── Clientes por frecuencia de compra + fecha de última compra ──
// Ordenado por última compra ascendente (más antigua primero) para que los
// clientes que dejaron de pedir aparezcan arriba -- ese es el propósito
// explícito de esta tabla.
const clientesFrecuencia = async () => {
  const rows = await prisma.$queryRaw`
    SELECT
      c.id_cliente,
      u.nombre,
      u.email,
      COUNT(v.id_venta) FILTER (WHERE e.nombre_estado = 'entregado')::int AS total_compras,
      MAX(v.fecha) FILTER (WHERE e.nombre_estado = 'entregado') AS ultima_compra
    FROM clientes c
    JOIN usuarios u ON u.id_usuario = c.id_usuario
    LEFT JOIN ventas v ON v.id_cliente = c.id_cliente
    LEFT JOIN estados e ON e.id_estado = v.id_estado
    WHERE u.estado = 1
    GROUP BY c.id_cliente, u.nombre, u.email
    HAVING COUNT(v.id_venta) FILTER (WHERE e.nombre_estado = 'entregado') > 0
    ORDER BY ultima_compra ASC NULLS FIRST
  `;
  return rows.map((r) => ({
    id_cliente:     r.id_cliente,
    nombre:         r.nombre,
    email:          r.email,
    total_compras:  r.total_compras,
    ultima_compra:  r.ultima_compra,
  }));
};

module.exports = { resumen, clientesFrecuencia };
