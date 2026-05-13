const prisma = require('../../config/prisma');

const MESES  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DIAS_S = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

const horaLabel = (h) => {
  if (h === 0)  return '12am';
  if (h < 12)   return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
};

const ventasPorMes = async () => {
  const año = new Date().getFullYear();
  const raw = await prisma.$queryRaw`
    SELECT
      EXTRACT(YEAR  FROM fecha)::int                               AS año,
      EXTRACT(MONTH FROM fecha)::int                               AS mes,
      COALESCE(SUM(total - COALESCE(costo_domicilio,0)), 0)        AS monto_total
    FROM ventas
    WHERE EXTRACT(YEAR FROM fecha) = ${año}
      AND id_estado != (SELECT id_estado FROM estados WHERE nombre_estado = 'anulado' LIMIT 1)
    GROUP BY año, mes
    ORDER BY mes ASC
  `;
  const meses = [];
  for (let m = 1; m <= 12; m++) {
    const found = raw.find((r) => Number(r.mes) === m);
    meses.push({ label: MESES[m - 1], mes: m, año, total: Number(found?.monto_total || 0) });
  }
  return meses;
};

const ventasPorDia = async (fecha) => {
  const fechaCO = fecha || new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const inicio  = new Date(fechaCO + 'T05:00:00.000Z');
  const fin     = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

  const estadoAnulado = await prisma.estado.findFirst({ where: { nombre_estado: 'anulado' } });
  const ventas = await prisma.venta.findMany({
    where: { fecha: { gte: inicio, lt: fin }, id_estado: { not: estadoAnulado?.id_estado } },
    select: { fecha: true, total: true, costo_domicilio: true },
  });

  const horas = {};
  for (let h = 0; h < 24; h++) horas[h] = 0;
  ventas.forEach((v) => {
    const hora = (new Date(v.fecha).getUTCHours() - 5 + 24) % 24;
    // Usar ingreso neto (total - costo_domicilio) para coincidir con "Ingresos hoy"
    const neto = Number(v.total) - Number(v.costo_domicilio || 0);
    horas[hora] = horas[hora] + neto;
  });

  const nonZero = Object.entries(horas).filter(([, t]) => t > 0);
  if (nonZero.length === 0) return [{ label: '—', total: 0 }];
  return nonZero
    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
    .map(([h, total]) => ({ label: horaLabel(Number(h)), total }));
};

const ventasPorSemana = async (fecha) => {
  const estadoAnulado = await prisma.estado.findFirst({ where: { nombre_estado: 'anulado' } });
  const hoy = fecha
    ? new Date(fecha + 'T12:00:00.000Z')
    : new Date(Date.now() - 5 * 60 * 60 * 1000); // Colombia UTC-5

  // Calcular lunes de la semana actual
  const diaSemana = hoy.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  const diasDesdeElLunes = diaSemana === 0 ? 6 : diaSemana - 1;
  const lunesCO = new Date(hoy);
  lunesCO.setDate(hoy.getDate() - diasDesdeElLunes);
  const lunesISO = lunesCO.toISOString().slice(0, 10);
  const lunes = new Date(lunesISO + 'T05:00:00.000Z'); // medianoche Colombia

  const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const ventas = await prisma.venta.findMany({
    where: {
      fecha: { gte: lunes, lt: new Date(lunes.getTime() + 7 * 24 * 60 * 60 * 1000) },
      id_estado: { not: estadoAnulado?.id_estado },
    },
    select: { fecha: true, total: true, costo_domicilio: true },
  });

  return diasSemana.map((label, i) => {
    const inicio = new Date(lunes.getTime() + i * 24 * 60 * 60 * 1000);
    const fin    = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    // Usar ingreso neto (total - costo_domicilio) para coincidir con "Ingresos hoy"
    const total  = ventas
      .filter((v) => new Date(v.fecha) >= inicio && new Date(v.fecha) < fin)
      .reduce((s, v) => s + Number(v.total) - Number(v.costo_domicilio || 0), 0);
    return { label, total };
  });
};

const productosMasVendidos = async () => {
  const estadosExcluidos = await prisma.estado.findMany({
    where: { nombre_estado: { in: ['anulado', 'pendiente'] } },
    select: { id_estado: true },
  });
  const idsExcluidos = estadosExcluidos.map((e) => e.id_estado);

  const agrupados = await prisma.detalleVenta.groupBy({
    by: ['id_producto'],
    where: { venta: { id_estado: { notIn: idsExcluidos } } },
    _sum:   { cantidad: true },
    _count: { id_producto: true },
    orderBy: { _sum: { cantidad: 'desc' } },
    take: 10,
  });

  const ids      = agrupados.map((r) => r.id_producto);
  const productos = await prisma.producto.findMany({ where: { id_producto: { in: ids } } });
  const map      = Object.fromEntries(productos.map((p) => [p.id_producto, p]));

  return agrupados.map((r) => ({
    producto:      map[r.id_producto],
    total_vendido: r._sum.cantidad,
  }));
};

const totalDia = async (fecha) => {
  const estadoAnulado   = await prisma.estado.findFirst({ where: { nombre_estado: 'anulado' } });
  const estadoEntregado = await prisma.estado.findFirst({ where: { nombre_estado: 'entregado' } });

  const fechaWhere = fecha ? (() => {
    const inicio = new Date(fecha + 'T05:00:00.000Z');
    const fin    = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    return { gte: inicio, lt: fin };
  })() : undefined;

  const [result, domicilios, pagos] = await Promise.all([
    prisma.venta.aggregate({
      where: { ...(fechaWhere ? { fecha: fechaWhere } : {}), id_estado: { not: estadoAnulado?.id_estado } },
      _sum:   { total: true },
      _count: { id_venta: true },
    }),
    prisma.venta.aggregate({
      where: { ...(fechaWhere ? { fecha: fechaWhere } : {}), id_estado: estadoEntregado?.id_estado },
      _sum: { costo_domicilio: true },
    }),
    prisma.detallePago.findMany({
      where: { pago: { venta: { ...(fechaWhere ? { fecha: fechaWhere } : {}), id_estado: estadoEntregado?.id_estado } } },
      include: { metodoPago: true },
    }),
  ]);

  const efectivoBruto  = pagos.filter((p) => p.metodoPago?.nombre === 'efectivo').reduce((a, p) => a + Number(p.monto), 0);
  const transferencia  = pagos.filter((p) => p.metodoPago?.nombre === 'transferencia').reduce((a, p) => a + Number(p.monto), 0);
  const totalDomicilios = Number(domicilios._sum.costo_domicilio || 0);
  const efectivoNeto   = efectivoBruto - totalDomicilios;
  const ingresoTotal   = efectivoNeto + transferencia;

  return {
    fecha:                fecha || null,
    total_ventas:         result._count.id_venta,
    monto_total:          ingresoTotal,
    total_efectivo:       efectivoNeto,
    total_efectivo_bruto: efectivoBruto,
    total_transferencia:  transferencia,
    total_domicilios:     totalDomicilios,
  };
};

const domiciliariosDia = async (fecha) => {
  const fechaCO = fecha || new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const inicio  = new Date(fechaCO + 'T05:00:00.000Z');
  const fin     = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

  const ventas = await prisma.venta.findMany({
    where: {
      fecha: { gte: inicio, lt: fin },
      estado: { nombre_estado: 'entregado' },
      // Solo ventas con pago registrado (facturadas por un domi)
      pagos: { some: { id_empleado: { not: undefined } } },
    },
    include: {
      pagos: { include: {
        empleado: { include: { usuario: true } },
        detallePagos: { include: { metodoPago: true } },
      }},
      ventasDomiciliario: { include: { empleado: { include: { usuario: true } } } },
    },
  });

  const resumen = {};
  ventas.forEach((v) => {
    const nombre = v.pagos?.[0]?.empleado?.usuario?.nombre
      || v.ventasDomiciliario?.[0]?.empleado?.usuario?.nombre;
    if (!nombre) return; // omitir ventas sin domi identificable

    if (!resumen[nombre]) resumen[nombre] = { nombre, entregas: 0, efectivo: 0, transferencia: 0, total: 0 };
    resumen[nombre].entregas++;
    resumen[nombre].total += Number(v.total);

    const detallePagos = v.pagos?.[0]?.detallePagos || [];
    if (detallePagos.length > 0) {
      detallePagos.forEach((dp) => {
        if (dp.metodoPago?.nombre === 'efectivo')      resumen[nombre].efectivo      += Number(dp.monto);
        if (dp.metodoPago?.nombre === 'transferencia') resumen[nombre].transferencia += Number(dp.monto);
      });
    } else {
      // Fallback a columnas de la venta
      resumen[nombre].efectivo      += Number(v.monto_efectivo      || 0);
      resumen[nombre].transferencia += Number(v.monto_transferencia || 0);
    }
  });
  return Object.values(resumen);
};

const totalidadClientes = async (fecha) => {
  const fechaCO = fecha || new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const inicio  = new Date(fechaCO + 'T05:00:00.000Z');
  const fin     = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

  const [total, nuevosHoy] = await Promise.all([
    prisma.usuario.count({ where: { estado: 1 } }),
    prisma.usuario.count({ where: { estado: 1, fecha_registro: { gte: inicio, lt: fin } } }),
  ]);
  return { total, nuevosHoy };
};

const recaudoPedidos = async () => {
  const result = await prisma.pago.aggregate({
    _sum:   { total_pagado: true },
    _count: { id_pago: true },
  });
  return { total_pagos: result._count.id_pago, total_recaudo: result._sum.total_pagado || 0 };
};

const pedidosRecientes = async (limite = 10, fecha) => {
  const where = {};
  if (fecha) {
    const inicio = new Date(fecha + 'T05:00:00.000Z');
    const fin    = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);
    where.fecha  = { gte: inicio, lte: fin };
  }
  return prisma.venta.findMany({
    take:    Number(limite),
    where,
    orderBy: { fecha: 'desc' },
    include: {
      estado:  true,
      cliente: { include: { usuario: { select: { nombre: true, email: true } } } },
    },
  });
};

module.exports = { ventasPorMes, ventasPorDia, ventasPorSemana, productosMasVendidos,
  totalDia, totalidadClientes, recaudoPedidos, pedidosRecientes, domiciliariosDia };
