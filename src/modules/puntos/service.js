const prisma = require('../../config/prisma');
const { valorPunto } = require('../configuracion/service');

const PESOS_POR_PUNTO = 500;

const obtenerPuntos = async (id_cliente) => {
  const [registro, valorPuntoActual] = await Promise.all([
    prisma.puntosCliente.findUnique({
      where: { id_cliente },
      include: { movimientos: { orderBy: { fecha: 'desc' }, take: 10 } },
    }),
    valorPunto(),
  ]);
  if (!registro) return { puntos: 0, saldo_pesos: 0, movimientos: [] };
  return {
    puntos:      registro.puntos,
    // Siempre en tiempo real con el valor ACTUAL configurado -- no hay
    // "valor histórico" del punto, si el admin lo cambia el saldo en pesos
    // de todos los clientes cambia de inmediato (ver configuracion/service.js).
    saldo_pesos: registro.puntos * valorPuntoActual,
    movimientos: registro.movimientos,
  };
};

const calcularPuntosGanados = (subtotal_productos) =>
  Math.floor(subtotal_productos / PESOS_POR_PUNTO);

const calcularDescuentoPuntos = async (puntos_a_usar) =>
  puntos_a_usar * (await valorPunto());

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

module.exports = {
  obtenerPuntos, calcularPuntosGanados, calcularDescuentoPuntos,
  acumularPuntos, valorPunto, PESOS_POR_PUNTO,
};
