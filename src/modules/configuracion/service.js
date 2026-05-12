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

module.exports = { obtener, actualizar, tiempoEspera };
