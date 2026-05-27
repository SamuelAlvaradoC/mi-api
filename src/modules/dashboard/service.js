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
      EXTRACT(YEAR  FROM fecha)::int AS año,
      EXTRACT(MONTH FROM fecha)::int AS mes,
      COALESCE(SUM(
        CASE
          WHEN COALESCE(monto_efectivo,0) + COALESCE(monto_transferencia,0) > 0
          THEN COALESCE(monto_efectivo,0) + COALESCE(monto_transferencia,0) - COALESCE(costo_domicilio,0)
          ELSE total - COALESCE(costo_domicilio,0)
        END
      ), 0) AS monto_total
    FROM ventas
    WHERE EXTRACT(YEAR FROM fecha) = ${año}
      AND id_estado = (SELECT id_estado FROM estados WHERE nombre_estado = 'entregado' LIMIT 1)
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

  const [estadoAnulado, estadoEntregado] = await Promise.all([
    prisma.estado.findFirst({ where: { nombre_estado: 'anulado' } }),
    prisma.estado.findFirst({ where: { nombre_estado: 'entregado' } }),
  ]);
  const ventas = await prisma.venta.findMany({
    where: { fecha: { gte: inicio, lt: fin }, id_estado: estadoEntregado?.id_estado },
    select: { fecha: true, total: true, costo_domicilio: true, monto_efectivo: true, monto_transferencia: true },
  });

  const horas = {};
  for (let h = 0; h < 24; h++) horas[h] = 0;
  ventas.forEach((v) => {
    const hora = (new Date(v.fecha).getUTCHours() - 5 + 24) % 24;
    const ef   = Number(v.monto_efectivo || 0);
    const tr   = Number(v.monto_transferencia || 0);
    const dom  = Number(v.costo_domicilio || 0);
    const neto = (ef + tr > 0) ? (ef + tr - dom) : (Number(v.total) - dom);
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
  const estadoEntregadoSem = await prisma.estado.findFirst({ where: { nombre_estado: 'entregado' } });
  const ventas = await prisma.venta.findMany({
    where: {
      fecha: { gte: lunes, lt: new Date(lunes.getTime() + 7 * 24 * 60 * 60 * 1000) },
      id_estado: estadoEntregadoSem?.id_estado,
    },
    select: { fecha: true, total: true, costo_domicilio: true, monto_efectivo: true, monto_transferencia: true },
  });

  return diasSemana.map((label, i) => {
    const inicio = new Date(lunes.getTime() + i * 24 * 60 * 60 * 1000);
    const fin    = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    const total  = ventas
      .filter((v) => new Date(v.fecha) >= inicio && new Date(v.fecha) < fin)
      .reduce((s, v) => {
        const ef  = Number(v.monto_efectivo || 0);
        const tr  = Number(v.monto_transferencia || 0);
        const dom = Number(v.costo_domicilio || 0);
        return s + ((ef + tr > 0) ? (ef + tr - dom) : (Number(v.total) - dom));
      }, 0);
    return { label, total };
  });
};

const productosMasVendidos = async () => {
  const agrupados = await prisma.detalleVenta.groupBy({
    by: ['id_producto'],
    where: { venta: { estado: { nombre_estado: 'entregado' } } },
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

  // Solo contar ventas ENTREGADAS — pedidos pendientes no son ingresos reales aún
  const ventas = await prisma.venta.findMany({
    where: { ...(fechaWhere ? { fecha: fechaWhere } : {}), id_estado: estadoEntregado?.id_estado },
    select: { id_venta: true, total: true, costo_domicilio: true, monto_efectivo: true, monto_transferencia: true },
  });

  const totalVentas    = ventas.length;
  const efectivoBruto  = ventas.reduce((s, v) => s + Number(v.monto_efectivo || 0), 0);
  const transferencia  = ventas.reduce((s, v) => s + Number(v.monto_transferencia || 0), 0);
  const totalDomicilios = ventas.reduce((s, v) => s + Number(v.costo_domicilio || 0), 0);

  const efectivoNeto = efectivoBruto - totalDomicilios;
  const ingresoTotal = efectivoNeto + transferencia;

  return {
    fecha:                fecha || null,
    total_ventas:         totalVentas,
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

  // Leer directo de ventas: id_domiciliario ya tiene quién entregó
  const ventas = await prisma.venta.findMany({
    where: {
      fecha: { gte: inicio, lt: fin },
      estado: { nombre_estado: 'entregado' },
    },
    select: {
      total: true,
      costo_domicilio: true,
      monto_efectivo: true,
      monto_transferencia: true,
      id_domiciliario: true,
    },
  });

  // Cargar nombres de domiciliarios de una vez
  const ids = [...new Set(ventas.map(v => v.id_domiciliario).filter(Boolean))];
  const empleados = ids.length > 0
    ? await prisma.empleado.findMany({
        where: { id_empleado: { in: ids } },
        include: { usuario: { select: { nombre: true } } },
      })
    : [];
  const nombrePorId = Object.fromEntries(empleados.map(e => [e.id_empleado, e.usuario?.nombre || '—']));

  const resumen = {};
  ventas.forEach((v) => {
    const nombre = v.id_domiciliario ? (nombrePorId[v.id_domiciliario] || 'Desconocido') : 'Sin asignar';
    if (!resumen[nombre]) resumen[nombre] = { nombre, entregas: 0, efectivo: 0, transferencia: 0, total: 0 };
    resumen[nombre].entregas++;
    resumen[nombre].total      += Number(v.total);
    resumen[nombre].efectivo   += Number(v.monto_efectivo      || 0);
    resumen[nombre].transferencia += Number(v.monto_transferencia || 0);
  });

  return Object.values(resumen).filter(r => r.entregas > 0);
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
