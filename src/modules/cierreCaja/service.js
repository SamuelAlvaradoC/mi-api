const prisma = require('../../config/prisma');

const TIPOS_GASTO = ['domiciliario', 'empleado', 'insumos'];

// Rango del día actual en horario Colombia (UTC-5), mismo criterio que dashboard/service.js
const rangoHoy = () => {
  const fechaCO = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const inicio  = new Date(fechaCO + 'T05:00:00.000Z');
  const fin     = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  return { fechaCO, inicio, fin };
};

const obtenerCierreHoy = async () => {
  const { inicio, fin } = rangoHoy();
  return prisma.cierreCaja.findFirst({
    where: { fecha: { gte: inicio, lt: fin } },
    include: { gastos: { orderBy: { fecha: 'asc' } } },
  });
};

const crearBase = async (id_usuario, base_inicial) => {
  const existente = await obtenerCierreHoy();
  if (existente) throw { status: 409, message: 'Ya existe una base inicial registrada para hoy' };

  const valor = Number(base_inicial);
  if (isNaN(valor) || valor < 0) throw { status: 400, message: 'La base inicial debe ser un número válido' };

  return prisma.cierreCaja.create({
    data: { base_inicial: valor, creado_por: id_usuario },
    include: { gastos: true },
  });
};

const obtenerOcrearCierre = async (id_usuario) => {
  const existente = await obtenerCierreHoy();
  if (existente) return existente;
  return prisma.cierreCaja.create({
    data: { base_inicial: 0, creado_por: id_usuario },
    include: { gastos: true },
  });
};

const agregarGasto = async (id_usuario, { tipo, descripcion, valor }) => {
  if (!TIPOS_GASTO.includes(tipo)) throw { status: 400, message: 'Tipo de gasto inválido' };
  if (!descripcion || !String(descripcion).trim()) throw { status: 400, message: 'La descripción es obligatoria' };

  const valorNum = Number(valor);
  if (isNaN(valorNum) || valorNum <= 0) throw { status: 400, message: 'El valor del gasto debe ser mayor a 0' };

  const cierre = await obtenerOcrearCierre(id_usuario);
  return prisma.gastoDia.create({
    data: { id_cierre: cierre.id_cierre, tipo, descripcion: String(descripcion).trim(), valor: valorNum },
  });
};

const eliminarGasto = async (id_gasto) => {
  const id = Number(id_gasto);
  const gasto = await prisma.gastoDia.findUnique({ where: { id_gasto: id } });
  if (!gasto) throw { status: 404, message: 'Gasto no encontrado' };
  await prisma.gastoDia.delete({ where: { id_gasto: id } });
  return { id_gasto: id };
};

const resumenDia = async () => {
  const { fechaCO, inicio, fin } = rangoHoy();
  const estadoEntregado = await prisma.estado.findFirst({ where: { nombre_estado: 'entregado' } });

  // Cálculo propio e independiente del dashboard (que ya neta los domicilios) para
  // evitar restar costo_domicilio dos veces sobre dinero real.
  const ventas = await prisma.venta.findMany({
    where: { fecha: { gte: inicio, lt: fin }, id_estado: estadoEntregado?.id_estado },
    select: { monto_efectivo: true, monto_transferencia: true, costo_domicilio: true },
  });

  const total_efectivo      = ventas.reduce((s, v) => s + Number(v.monto_efectivo || 0), 0);
  const total_transferencia = ventas.reduce((s, v) => s + Number(v.monto_transferencia || 0), 0);
  const total_domicilios    = ventas.reduce((s, v) => s + Number(v.costo_domicilio || 0), 0);
  const total_ventas        = total_efectivo + total_transferencia;
  const efectivo_sin_domicilios = total_efectivo - total_domicilios;

  const cierre        = await obtenerCierreHoy();
  const base_inicial  = cierre ? Number(cierre.base_inicial) : 0;
  const gastos        = cierre ? cierre.gastos : [];
  const total_gastos  = gastos.reduce((s, g) => s + Number(g.valor), 0);

  const gastos_por_tipo = gastos.reduce((acc, g) => {
    (acc[g.tipo] = acc[g.tipo] || []).push(g);
    return acc;
  }, {});

  const saldo_final = base_inicial + total_efectivo - total_gastos;

  return {
    fecha: fechaCO,
    base_registrada: !!cierre,
    base_inicial,
    total_ventas,
    total_efectivo,
    efectivo_sin_domicilios,
    total_transferencia,
    total_domicilios,
    gastos,
    gastos_por_tipo,
    total_gastos,
    saldo_final,
  };
};

module.exports = { obtenerCierreHoy, crearBase, agregarGasto, eliminarGasto, resumenDia };
