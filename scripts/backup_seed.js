// Backup "de arranque limpio": exporta solo lo que hace falta para dejar el
// aplicativo funcional pero en cero en ventas — sin clientes, direcciones,
// ventas, reseñas ni cierres de caja.
//
// Uso:  node scripts/backup_seed.js
// Genera: backups/seed_YYYY-MM-DD_HHmm.json (no se sube a git, ver .gitignore)

const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/prisma');

// Cuentas de staff a conservar (los 2 admin + el confirmador real).
// testdebug999@test.com es una cuenta confirmador_domicilio de prueba/debug —
// se excluye a propósito, no es un descuido.
const EMAILS_STAFF_A_CONSERVAR = [
  'esneider@outlook.com',
  'samuelalvaradocorrea@gmail.com',
  'neider8020@gmail.com',
];

async function main() {
  const usuarios = await prisma.usuario.findMany({
    where: { email: { in: EMAILS_STAFF_A_CONSERVAR } },
    select: {
      id_usuario: true, id_rol: true, nombre: true, email: true,
      contrasena: true, estado: true, fecha_registro: true, ips_conocidas: true,
    },
  });
  const idsUsuario = usuarios.map((u) => u.id_usuario);

  const backup = {
    generado_en: new Date().toISOString(),
    nota: 'Backup de arranque limpio — sin clientes, direcciones, ventas, reseñas ni cierres de caja.',

    roles:        await prisma.rol.findMany(),
    permisos:      await prisma.permiso.findMany(),
    rolPermisos:   await prisma.rolPermiso.findMany(),

    usuarios,
    empleados: await prisma.empleado.findMany({ where: { id_usuario: { in: idsUsuario } } }),

    categorias:    await prisma.categoria.findMany(),
    productos:     await prisma.producto.findMany(),
    toppings:      await prisma.topping.findMany(),
    adiciones:     await prisma.adicion.findMany(),

    ciudades:      await prisma.ciudad.findMany(),
    barrios:       await prisma.barrio.findMany(),

    estados:          await prisma.estado.findMany(),
    estadosDomicilio: await prisma.estadoDomicilio.findMany(),
    metodosPago:      await prisma.metodoPago.findMany(),
    configuracion:    await prisma.configuracion.findMany(),
  };

  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const archivo = path.join(dir, `seed_${stamp}.json`);
  fs.writeFileSync(archivo, JSON.stringify(backup, null, 2), 'utf-8');

  console.log('Backup generado en:', archivo);
  console.log('');
  for (const [tabla, filas] of Object.entries(backup)) {
    if (Array.isArray(filas)) console.log(`  ${tabla.padEnd(18)} ${filas.length} fila(s)`);
  }
  if (usuarios.length !== EMAILS_STAFF_A_CONSERVAR.length) {
    console.warn(`\n⚠ Se esperaban ${EMAILS_STAFF_A_CONSERVAR.length} cuentas de staff y se encontraron ${usuarios.length}. Revisa EMAILS_STAFF_A_CONSERVAR.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
