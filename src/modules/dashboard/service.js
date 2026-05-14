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

  const [estadoAnulado, estadoEntregado] = await Promise.all([
    prisma.estado.findFirst({ where: { nombre_estado: 'anulado' } }),
    prisma.estado.findFirst({ where: { nombre_estado: 'entregado' } }),
  ]);
  const ventas = await prisma.venta.findMany({
    where: { fecha: { gte: inicio, lt: fin }, id_estado: { not: estadoAnulado?.id_estado } },
    select: { fecha: true, total: true, costo_domicilio: true, monto_efectivo: true, monto_transferencia: true, id_estado: true },
  });

  const horas = {};
  for (let h = 0; h < 24; h++) horas[h] = 0;
  ventas.forEach((v) => {
    const hora = (new Date(v.fecha).getUTCHours() - 5 + 24) % 24;
    const ef   = Number(v.monto_efectivo || 0);
    const tr   = Number(v.monto_transferencia || 0);
    // Solo restar domicilio si la venta está entregada (misma lógica que totalDia)
    const dom  = (v.id_estado === estadoEntregado?.id_estado) ? Number(v.costo_domicilio || 0) : 0;
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
  const ventas = await prisma.venta.findMany({
    where: {
      fecha: { gte: lunes, lt: new Date(lunes.getTime() + 7 * 24 * 60 * 60 * 1000) },
      id_estado: { not: estadoAnulado?.id_estado },
    },
    select: { fecha: true, total: true, costo_domicilio: true, monto_efectivo: true, monto_transferencia: true, id_estado: true },
  });

  const estadoEntregadoSem = await prisma.estado.findFirst({ where: { nombre_estado: 'entregado' } });

  return diasSemana.map((label, i) => {
    const inicio = new Date(lunes.getTime() + i * 24 * 60 * 60 * 1000);
    const fin    = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
    const total  = ventas
      .filter((v) => new Date(v.fecha) >= inicio && new Date(v.fecha) < fin)
      .reduce((s, v) => {
        const ef  = Number(v.monto_efectivo || 0);
        const tr  = Number(v.monto_transferencia || 0);
        const dom = (v.id_estado === estadoEntregadoSem?.id_estado) ? Number(v.costo_domicilio || 0) : 0;
        return s + ((ef + tr > 0) ? (ef + tr - dom) : (Number(v.total) - dom));
      }, 0);
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

  // Leer directamente de la tabla ventas (monto_efectivo / monto_transferencia)
  // ya que detallePago solo existe cuando el admin registra pago manualmente.
  const ventas = await prisma.venta.findMany({
    where: { ...(fechaWhere ? { fecha: fechaWhere } : {}), id_estado: { not: estadoAnulado?.id_estado } },
    select: { id_venta: true, id_estado: true, total: true, costo_domicilio: true, monto_efectivo: true, monto_transferencia: true },
  });

  const totalVentas    = ventas.length;
  const efectivoBruto  = ventas.reduce((s, v) => s + Number(v.monto_efectivo || 0), 0);
  const transferencia  = ventas.reduce((s, v) => s + Number(v.monto_transferencia || 0), 0);

  // Domicilios: solo de ventas ya entregadas (se le pagan al domi con el efectivo)
  const totalDomicilios = ventas
    .filter((v) => v.id_estado === estadoEntregado?.id_estado)
    .reduce((s, v) => s + Number(v.costo_domicilio || 0), 0);

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

  // Estrategia: buscar ventasDomiciliario con hora_entrega HOY
  // (creados por cambiarEstado desde hoy en adelante)
  const registrosDomi = await prisma.ventaDomiciliario.findMany({
    where: {
      hora_entrega: { gte: inicio, lt: fin },
    },
    include: {
      empleado: { include: { usuario: { select: { nombre: true } } } },
      venta: {
        select: { total: true, monto_efectivo: true, monto_transferencia: true,
          pagos: { include: { detallePagos: { include: { metodoPago: true } } } } },
      },
    },
  });

  // Fallback: ventas entregadas del día por venta.fecha (para registros históricos)
  const ventasFallback = await prisma.venta.findMany({
    where: {
      fecha: { gte: inicio, lt: fin },
      estado: { nombre_estado: 'entregado' },
      // Que tengan algún ventasDomiciliario con hora_entrega fuera del rango o sin ella
      NOT: { ventasDomiciliario: { some: { hora_entrega: { gte: inicio, lt: fin } } } },
    },
    include: {
      ventasDomiciliario: {
        include: { empleado: { include: { usuario: { select: { nombre: true } } } } },
        orderBy: { id_venta_domiciliario: 'desc' },
        take: 1,
      },
      pagos: {
        include: {
          empleado: { include: { usuario: { select: { nombre: true } } } },
          detallePagos: { include: { metodoPago: true } },
        },
      },
    },
  });

  const resumen = {};

  // Procesar registros con hora_entrega de hoy
  registrosDomi.forEach((rd) => {
    const nombre = rd.empleado?.usuario?.nombre;
    if (!nombre) return;
    const v = rd.venta;
    if (!resumen[nombre]) resumen[nombre] = { nombre, entregas: 0, efectivo: 0, transferencia: 0, total: 0 };
    resumen[nombre].entregas++;
    resumen[nombre].total += Number(v.total);
    const detalles = v.pagos?.[0]?.detallePagos || [];
    if (detalles.length > 0) {
      detalles.forEach((dp) => {
        if (dp.metodoPago?.nombre === 'efectivo')      resumen[nombre].efectivo      += Number(dp.monto);
        if (dp.metodoPago?.nombre === 'transferencia') resumen[nombre].transferencia += Number(dp.monto);
      });
    } else {
      resumen[nombre].efectivo      += Number(v.monto_efectivo      || 0);
      resumen[nombre].transferencia += Number(v.monto_transferencia || 0);
    }
  });

  // Procesar ventas sin hora_entrega registrada (fallback histórico)
  ventasFallback.forEach((v) => {
    const nombre =
      v.ventasDomiciliario?.[0]?.empleado?.usuario?.nombre ||
      v.pagos?.[0]?.empleado?.usuario?.nombre;
    if (!nombre) return;
    if (!resumen[nombre]) resumen[nombre] = { nombre, entregas: 0, efectivo: 0, transferencia: 0, total: 0 };
    resumen[nombre].entregas++;
    resumen[nombre].total += Number(v.total);
    const detalles = v.pagos?.[0]?.detallePagos || [];
    if (detalles.length > 0) {
      detalles.forEach((dp) => {
        if (dp.metodoPago?.nombre === 'efectivo')      resumen[nombre].efectivo      += Number(dp.monto);
        if (dp.metodoPago?.nombre === 'transferencia') resumen[nombre].transferencia += Number(dp.monto);
      });
    } else {
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
