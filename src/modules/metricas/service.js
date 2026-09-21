const prisma = require('../../config/prisma');
const { ventasPorMes } = require('../dashboard/service');

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Rango [inicio, fin) de un mes en hora Colombia (día calendario colombiano
// empieza a las 05:00 UTC, mismo criterio que el resto del dashboard).
// `mes` es 1-12 sobre el año actual -- el filtro de mes del admin no cruza
// años, igual que ventasPorMes() (dashboard/service.js), que ya está fijado
// al año en curso.
const rangoMes = (mes) => {
  const ahoraCO = new Date(Date.now() - 5 * 60 * 60 * 1000);
  const anio = ahoraCO.getUTCFullYear();
  const mesActual = ahoraCO.getUTCMonth() + 1;
  const m = mes && mes >= 1 && mes <= 12 ? mes : mesActual;
  const inicio = new Date(Date.UTC(anio, m - 1, 1, 5, 0, 0));
  const fin    = new Date(Date.UTC(anio, m, 1, 5, 0, 0));
  return { inicio, fin, mes: m, anio, mesActual };
};

// ── Resumen: clientes registrados, puntos redimidos, ventas netas,
//    número de pedidos, nuevos vs recurrentes y desglose por método de pago
//    -- todo del mes indicado (o el mes actual si no se pasa uno) ──
const resumen = async (mesParam) => {
  const { inicio, fin, mes, anio } = rangoMes(mesParam);

  const [clientesRegistrados, estadoEntregado, mesesNetas] = await Promise.all([
    // Fila en `clientes`, no en `usuarios` -- usuario.count({estado:1})
    // incluía admins/empleados/domiciliarios/cocineros además de clientes,
    // inflando el número (ej. 189 usuarios activos vs 183 clientes reales).
    prisma.cliente.count(),
    prisma.estado.findFirst({ where: { nombre_estado: 'entregado' } }),
    ventasPorMes(),
  ]);

  // Puntos redimidos del mes: suma de puntos_usados en ventas no anuladas
  // creadas ese mes (el descuento se aplica al momento de crear la venta,
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

  // Número de ventas del mes -- solo entregadas, mismo criterio que ventas
  // netas y el desglose de pago ("Ventas" en este negocio = ya entregada y
  // cobrada, no cualquier pedido que haya entrado al pipeline).
  const numeroVentasMes = await prisma.venta.count({
    where: { fecha: { gte: inicio, lt: fin }, id_estado: estadoEntregado?.id_estado },
  });

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

  const ventasNetasMes = mesesNetas.find((m2) => m2.mes === mes)?.total || 0;

  // Promedio mensual: solo sobre los meses que ya tienen al menos una venta
  // -- dividir entre los 12 meses del año (o entre los "transcurridos")
  // hundía el número sin razón cuando el negocio recién empezó a usar la
  // página. Es un indicador anual, no depende del mes filtrado arriba.
  const mesesConVentas = mesesNetas.filter((m2) => m2.total > 0);
  const promedioMensual = mesesConVentas.length > 0
    ? mesesConVentas.reduce((s, m2) => s + m2.total, 0) / mesesConVentas.length
    : 0;

  // Clientes nuevos vs recurrentes del mes: "nuevo" = su primera compra
  // entregada JAMÁS cae dentro de este mes; "recurrente" = ya tenía al menos
  // una compra entregada antes del inicio del mes. Un solo query con CTE:
  // primero la fecha de la primera compra de cada cliente, luego se cuenta
  // quiénes compraron este mes separados por si esa primera compra es este
  // mes o anterior.
  const idEstadoEntregado = estadoEntregado?.id_estado ?? -1;
  const nuevosVsRecurrentes = await prisma.$queryRaw`
    WITH primera_compra AS (
      SELECT id_cliente, MIN(fecha) AS primera
      FROM ventas
      WHERE id_estado = ${idEstadoEntregado}
      GROUP BY id_cliente
    ),
    compraron_este_mes AS (
      SELECT DISTINCT id_cliente
      FROM ventas
      WHERE id_estado = ${idEstadoEntregado} AND fecha >= ${inicio} AND fecha < ${fin}
    )
    SELECT
      COUNT(*) FILTER (WHERE pc.primera >= ${inicio} AND pc.primera < ${fin})::int AS nuevos,
      COUNT(*) FILTER (WHERE pc.primera < ${inicio})::int AS recurrentes
    FROM compraron_este_mes cm
    JOIN primera_compra pc ON pc.id_cliente = cm.id_cliente
  `;
  const { nuevos = 0, recurrentes = 0 } = nuevosVsRecurrentes[0] || {};

  return {
    mes, anio, mes_label: MESES[mes - 1],
    clientes_registrados: clientesRegistrados,
    puntos_redimidos_mes: puntosRedimidosMes,
    ventas_netas_mes:     Math.round(ventasNetasMes),
    promedio_mensual:     Math.round(promedioMensual),
    numero_ventas_mes:    numeroVentasMes,
    clientes_nuevos_mes:      nuevos,
    clientes_recurrentes_mes: recurrentes,
    desglose_pago:        desglosePago,
  };
};

// ── Meses del año en curso que ya tienen al menos una venta registrada --
//    para que el selector de mes del admin no ofrezca meses sin actividad
//    (ej. antes de que el negocio empezara a usar la página) ──
const mesesDisponibles = async () => {
  const anio = new Date(Date.now() - 5 * 60 * 60 * 1000).getUTCFullYear();
  const raw = await prisma.$queryRaw`
    SELECT DISTINCT EXTRACT(MONTH FROM (fecha - interval '5 hours'))::int AS mes
    FROM ventas
    WHERE EXTRACT(YEAR FROM (fecha - interval '5 hours')) = ${anio}
    ORDER BY mes ASC
  `;
  const meses = raw.map((r) => Number(r.mes));
  // Si por lo que sea todavía no hay ninguna venta este año, al menos deja
  // seleccionable el mes actual -- el selector nunca debe quedar vacío.
  const mesActual = new Date(Date.now() - 5 * 60 * 60 * 1000).getUTCMonth() + 1;
  if (!meses.includes(mesActual)) meses.push(mesActual);
  return meses.sort((a, b) => a - b).map((mes) => ({ mes, anio, label: MESES[mes - 1] }));
};

// ── Clientes registrados a lo largo del tiempo -- 'dia' agrupa los días del
//    mes indicado (o el actual), 'mes' agrupa los 12 meses del año en curso
//    (mismo año fijo que ventasPorMes) ──
const registros = async (granularidad, mesParam) => {
  if (granularidad === 'dia') {
    const { inicio, fin, mes, anio } = rangoMes(mesParam);
    const raw = await prisma.$queryRaw`
      SELECT EXTRACT(DAY FROM (fecha_registro - interval '5 hours'))::int AS dia, COUNT(*)::int AS cantidad
      FROM usuarios u
      JOIN clientes c ON c.id_usuario = u.id_usuario
      WHERE fecha_registro >= ${inicio} AND fecha_registro < ${fin}
      GROUP BY dia
      ORDER BY dia ASC
    `;
    const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
    const serie = [];
    for (let d = 1; d <= diasEnMes; d++) {
      const found = raw.find((r) => Number(r.dia) === d);
      serie.push({ label: String(d), cantidad: Number(found?.cantidad || 0) });
    }
    return serie;
  }

  // granularidad === 'mes'
  const anio = new Date(Date.now() - 5 * 60 * 60 * 1000).getUTCFullYear();
  const raw = await prisma.$queryRaw`
    SELECT EXTRACT(MONTH FROM (fecha_registro - interval '5 hours'))::int AS mes, COUNT(*)::int AS cantidad
    FROM usuarios u
    JOIN clientes c ON c.id_usuario = u.id_usuario
    WHERE EXTRACT(YEAR FROM (fecha_registro - interval '5 hours')) = ${anio}
    GROUP BY mes
    ORDER BY mes ASC
  `;
  const serie = [];
  for (let m = 1; m <= 12; m++) {
    const found = raw.find((r) => Number(r.mes) === m);
    serie.push({ label: MESES[m - 1], cantidad: Number(found?.cantidad || 0) });
  }
  return serie;
};

// ── Clientes por frecuencia de compra + fecha de última compra ──
// Ordenado por última compra ascendente (más antigua primero) para que los
// clientes que dejaron de pedir aparezcan arriba -- ese es el propósito
// explícito de esta tabla. Se trae todo (183 clientes hoy, escala bien a
// unos cuantos miles) y se filtra/pagina/segmenta en JS -- evita duplicar la
// misma agregación en dos queries (una para el resumen, otra paginada).
const clientesFrecuencia = async ({ q, page = 1, pageSize = 20, filtro } = {}) => {
  const rows = await prisma.$queryRaw`
    SELECT
      c.id_cliente,
      u.nombre,
      c.telefono,
      COUNT(v.id_venta) FILTER (WHERE e.nombre_estado = 'entregado')::int AS total_compras,
      MAX(v.fecha) FILTER (WHERE e.nombre_estado = 'entregado') AS ultima_compra,
      -- Ventanas móviles evaluadas contra "hoy" en cada consulta (no se
      -- guardan ni se precalculan) -- mismo criterio de "día calendario
      -- Colombia" que diaColombiaUTC() más abajo (restar 5h y truncar a
      -- fecha), expresado en SQL para no traer cada venta individual solo
      -- para contar cuántas caen en los últimos 7/30 días.
      COUNT(v.id_venta) FILTER (
        WHERE e.nombre_estado = 'entregado'
          AND (v.fecha - INTERVAL '5 hours')::date >= (NOW() - INTERVAL '5 hours')::date - INTERVAL '6 days'
      )::int AS compras_7d,
      COUNT(v.id_venta) FILTER (
        WHERE e.nombre_estado = 'entregado'
          AND (v.fecha - INTERVAL '5 hours')::date >= (NOW() - INTERVAL '5 hours')::date - INTERVAL '29 days'
      )::int AS compras_30d
    FROM clientes c
    JOIN usuarios u ON u.id_usuario = c.id_usuario
    LEFT JOIN ventas v ON v.id_cliente = c.id_cliente
    LEFT JOIN estados e ON e.id_estado = v.id_estado
    WHERE u.estado = 1
    GROUP BY c.id_cliente, u.nombre, c.telefono
    HAVING COUNT(v.id_venta) FILTER (WHERE e.nombre_estado = 'entregado') > 0
    ORDER BY ultima_compra ASC NULLS FIRST
  `;

  // Días calendario Colombia entre dos fechas (no horas transcurridas) -- se
  // resta 5h antes de truncar al día para que "ayer a las 11pm" cuente como
  // ayer y no como "hace 0 días" solo porque pasaron menos de 24h reales.
  const diaColombiaUTC = (fecha) => {
    const co = new Date(fecha.getTime() - 5 * 60 * 60 * 1000);
    return Date.UTC(co.getUTCFullYear(), co.getUTCMonth(), co.getUTCDate());
  };
  const hoyCO = diaColombiaUTC(new Date());
  // Segmento por prioridad de negocio: un cliente en riesgo de fuga importa
  // más que si además era "nuevo" o "frecuente" -- por eso se evalúa primero.
  let clientes = rows.map((r) => {
    const diasDesdeUltimaCompra = r.ultima_compra
      ? Math.round((hoyCO - diaColombiaUTC(new Date(r.ultima_compra))) / 86400000)
      : null;
    let segmento = 'activo';
    if (diasDesdeUltimaCompra !== null && diasDesdeUltimaCompra > 30) segmento = 'en_riesgo';
    else if (r.total_compras === 1) segmento = 'nuevo';
    else if (r.total_compras >= 5) segmento = 'frecuente';
    // Filtro de la tabla (Frecuentes/Activos/Todos) -- ventana móvil,
    // excluyente entre sí (se evalúa "frecuente" primero; solo si no
    // cumple se evalúa "activo"). Distinto del `segmento` de arriba (badge
    // de estrategia de negocio, basado en total histórico + días desde la
    // última compra) -- no se tocan ni se mezclan esas definiciones.
    let cumpleFiltro = null;
    if (r.compras_7d >= 3) cumpleFiltro = 'frecuentes';
    else if (r.compras_30d >= 2) cumpleFiltro = 'activos';
    return {
      id_cliente: r.id_cliente,
      nombre: r.nombre,
      telefono: r.telefono,
      total_compras: r.total_compras,
      ultima_compra: r.ultima_compra,
      dias_desde_ultima_compra: diasDesdeUltimaCompra,
      segmento,
      cumple_filtro: cumpleFiltro,
    };
  });

  // resumenSegmentos (badges de arriba de la tabla) SIEMPRE sobre la base
  // completa de clientes -- el filtro Frecuentes/Activos/Todos solo debe
  // afectar las filas de la tabla, no estos totales.
  // "frecuente"/"activo" del resumen usan cumple_filtro (ventana de 7/30
  // días) y no `segmento` -- estos dos numeros son los que el frontend usa
  // como botones de filtro, así que el número mostrado tiene que coincidir
  // con lo que realmente se ve al hacer clic. "nuevo"/"en_riesgo" siguen
  // con `segmento` (son solo informativos, no filtran nada).
  const resumenSegmentos = {
    total:      clientes.length,
    nuevo:      clientes.filter((c) => c.segmento === 'nuevo').length,
    en_riesgo:  clientes.filter((c) => c.segmento === 'en_riesgo').length,
    frecuente:  clientes.filter((c) => c.cumple_filtro === 'frecuentes').length,
    activo:     clientes.filter((c) => c.cumple_filtro === 'activos').length,
  };

  if (filtro === 'frecuentes' || filtro === 'activos') {
    clientes = clientes.filter((c) => c.cumple_filtro === filtro);
  }

  if (q && q.trim()) {
    const needle = q.trim().toLowerCase();
    clientes = clientes.filter((c) =>
      c.nombre?.toLowerCase().includes(needle) || c.telefono?.toLowerCase().includes(needle)
    );
  }

  const total = clientes.length;
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  const paginaSegura = Math.min(Math.max(1, page), totalPaginas);
  const inicioPagina = (paginaSegura - 1) * pageSize;
  const data = clientes.slice(inicioPagina, inicioPagina + pageSize);

  return { data, total, page: paginaSegura, pageSize, total_paginas: totalPaginas, resumen: resumenSegmentos };
};

module.exports = { resumen, registros, clientesFrecuencia, mesesDisponibles };
