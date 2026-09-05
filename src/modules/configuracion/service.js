const prisma = require('../../config/prisma');

const obtener = async (clave) => {
  const config = await prisma.configuracion.findUnique({ where: { clave } });
  return config?.valor || null;
};

const actualizar = async (clave, valor) => {
  return prisma.configuracion.upsert({
    where: { clave },
    update: { valor: String(valor) },
    create: { clave, valor: String(valor) },
  });
};

const tiempoEspera = async () => {
  const val = await obtener('tiempo_espera');
  return Number(val) || 30;
};

const horario = async () => {
  const [apertura, cierre, estado] = await Promise.all([
    obtener('hora_apertura'),
    obtener('hora_cierre'),
    obtener('estado_tienda'),
  ]);
  return {
    hora_apertura: Number(apertura) || 13,
    hora_cierre:   Number(cierre)   || 20,
    estado_tienda: estado           || 'schedule', // 'schedule' | 'open' | 'closed'
  };
};

// Valor en pesos de 1 punto de fidelidad al redimirlo (saldo_pesos del
// cliente y descuento en checkout). Editable solo por admin desde Perfil.
// Default 12.5 si la clave aún no existe -- mismo valor que estaba quemado
// antes de esta configuración, así que no rompe nada recién desplegado.
const valorPunto = async () => {
  const val = await obtener('valor_punto_pesos');
  return val !== null ? Number(val) : 12.5;
};

module.exports = { obtener, actualizar, tiempoEspera, horario, valorPunto };
