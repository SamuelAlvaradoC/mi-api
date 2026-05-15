const prisma = require('../../config/prisma');

const PESOS_POR_PUNTO = 500;
const VALOR_PUNTO     = 12.5;

const obtenerPuntos = async (id_cliente) => {
  const registro = await prisma.puntosCliente.findUnique({
    where: { id_cliente },
    include: { movimientos: { orderBy: { fecha: 'desc' }, take: 10 } },
  });
  if (!registro) return { puntos: 0, saldo_pesos: 0, movimientos: [] };
  return {
    puntos:      registro.puntos,
    saldo_pesos: registro.puntos * VALOR_PUNTO,
    movimientos: registro.movimientos,
  };
};

const calcularPuntosGanados = (subtotal_productos) =>
  Math.floor(subtotal_productos / PESOS_POR_PUNTO);

const calcularDescuentoPuntos = (puntos_a_usar) =>
  puntos_a_usar * VALOR_PUNTO;

const acumularPuntos = async (id_cliente, id_venta, subtotal_productos, uso_puntos) => {
  if (uso_puntos > 0) return null;
  const puntos_ganados = calcularPuntosGanados(subtotal_productos);
  if (puntos_ganados <= 0) return null;

  const registro = await prisma.puntosCliente.upsert({
    where:  { id_cliente },
    update: { puntos: { increment: puntos_ganados } },
    create: { id_cliente, puntos: puntos_ganados },
  });

  await prisma.movimientoPuntos.create({
    data: {
      id_puntos:   registro.id_puntos,
      id_venta,
      tipo:        'acumulacion',
      puntos:      puntos_ganados,
      descripcion: `Compra #${id_venta} — ganaste ${puntos_ganados} punto${puntos_ganados !== 1 ? 's' : ''}`,
    },
  });

  return { puntos_ganados, total_puntos: registro.puntos };
};

const redimirPuntos = async (id_cliente, id_venta, puntos_a_usar) => {
  const registro = await prisma.puntosCliente.findUnique({ where: { id_cliente } });
  if (!registro || registro.puntos < puntos_a_usar)
    throw { status: 400, message: 'Puntos insuficientes' };

  const descuento = calcularDescuentoPuntos(puntos_a_usar);

  await prisma.puntosCliente.update({
    where: { id_cliente },
    data:  { puntos: { decrement: puntos_a_usar } },
  });

  await prisma.movimientoPuntos.create({
    data: {
      id_puntos:   registro.id_puntos,
      id_venta,
      tipo:        'redencion',
      puntos:      -puntos_a_usar,
      descripcion: `Redención en compra #${id_venta} — descuento $${descuento.toLocaleString('es-CO')}`,
    },
  });

  return { puntos_usados: puntos_a_usar, descuento_aplicado: descuento };
};

module.exports = {
  obtenerPuntos, calcularPuntosGanados, calcularDescuentoPuntos,
  acumularPuntos, redimirPuntos, VALOR_PUNTO, PESOS_POR_PUNTO,
};
