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

module.exports = { obtener, actualizar, tiempoEspera, horario };
