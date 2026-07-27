require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function borrar() {
  const ids = process.argv.slice(2).map(Number);
  if (ids.length === 0) {
    console.log('Uso: node borrar_prueba.js ID1 ID2 ID3...');
    return;
  }
  await prisma.detalleTopping.deleteMany({
    where: { detalleVenta: { id_venta: { in: ids } } }
  });
  await prisma.detalleAdicion.deleteMany({
    where: { detalleVenta: { id_venta: { in: ids } } }
  });
  await prisma.detalleVenta.deleteMany({
    where: { id_venta: { in: ids } }
  });
  await prisma.venta.deleteMany({
    where: { id_venta: { in: ids } }
  });
  console.log('Borradas:', ids);
}
borrar().catch(console.error).finally(() => prisma.$disconnect());
