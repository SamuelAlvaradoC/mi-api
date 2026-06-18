const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

const backupsDir = path.join(__dirname, 'backups');
const fechas = fs.readdirSync(backupsDir)
  .filter(f => fs.statSync(path.join(backupsDir, f)).isDirectory())
  .sort();
if (fechas.length === 0) {
  console.error('❌ No hay backups disponibles');
  process.exit(1);
}
const ultimaFecha = fechas[fechas.length - 1];
const DIR = path.join(backupsDir, ultimaFecha);
console.log('📂 Usando backup:', ultimaFecha);

function leer(nombre) {
  return JSON.parse(fs.readFileSync(path.join(DIR, nombre + '.json'), 'utf8'));
}

function limpiar(registros, camposQuitar = []) {
  return registros.map(r => {
    const copia = { ...r };
    camposQuitar.forEach(c => delete copia[c]);
    return copia;
  });
}

async function restaurar(nombre, query) {
  try {
    const result = await query();
    const count = result?.count ?? '?';
    console.log('✅', nombre, '→', count, 'registros');
    return count;
  } catch (e) {
    console.log('❌', nombre, '→', e.message);
    throw e;
  }
}

async function restore() {
  console.log(`🔄 Restaurando BD desde backups/${ultimaFecha}/\n`);

  // 1. Estados (lookup)
  await restaurar('estados', () =>
    prisma.estado.createMany({ data: leer('estados'), skipDuplicates: true })
  );

  // 2. Permisos
  await restaurar('permisos', () =>
    prisma.permiso.createMany({ data: leer('permisos'), skipDuplicates: true })
  );

  // 3. Roles (quitar rolPermisos anidados)
  await restaurar('roles', () =>
    prisma.rol.createMany({
      data: limpiar(leer('roles'), ['rolPermisos', 'usuarios']),
      skipDuplicates: true,
    })
  );

  // 4. Rol permisos (tabla puente)
  await restaurar('rol_permisos', () =>
    prisma.rolPermiso.createMany({ data: leer('rol_permisos'), skipDuplicates: true })
  );

  // 5. Categorías
  await restaurar('categorias', () =>
    prisma.categoria.createMany({ data: leer('categorias'), skipDuplicates: true })
  );

  // 6. Usuarios staff (quitar relación anidada "rol")
  await restaurar('usuarios_staff', () =>
    prisma.usuario.createMany({
      data: limpiar(leer('usuarios_staff'), ['rol', 'cliente', 'empleado', 'resenas']),
      skipDuplicates: true,
    })
  );

  // 7. Empleados
  await restaurar('empleados', () =>
    prisma.empleado.createMany({
      data: limpiar(leer('empleados'), ['usuario', 'pagos', 'ventasDomiciliario']),
      skipDuplicates: true,
    })
  );

  // 8. Productos (quitar relación anidada "categoria")
  await restaurar('productos', () =>
    prisma.producto.createMany({
      data: limpiar(leer('productos'), ['categoria', 'detalleVentas']),
      skipDuplicates: true,
    })
  );

  // 9. Toppings
  await restaurar('toppings', () =>
    prisma.topping.createMany({
      data: limpiar(leer('toppings'), ['detalleToppings']),
      skipDuplicates: true,
    })
  );

  // 10. Adiciones
  await restaurar('adiciones', () =>
    prisma.adicion.createMany({
      data: limpiar(leer('adiciones'), ['detalleAdiciones']),
      skipDuplicates: true,
    })
  );

  // 11. Configuración
  await restaurar('configuracion', () =>
    prisma.configuracion.createMany({ data: leer('configuracion'), skipDuplicates: true })
  );

  // Sincronizar secuencias de autoincremento para evitar conflictos de PK
  console.log('\n🔧 Sincronizando secuencias de autoincremento...');
  const secuencias = [
    ['estados_id_estado_seq',             'estados',      'id_estado'],
    ['permisos_id_permiso_seq',           'permisos',     'id_permiso'],
    ['roles_id_rol_seq',                  'roles',        'id_rol'],
    ['rol_permisos_id_rol_permiso_seq',   'rol_permisos', 'id_rol_permiso'],
    ['categorias_id_categoria_seq',       'categorias',   'id_categoria'],
    ['usuarios_id_usuario_seq',           'usuarios',     'id_usuario'],
    ['empleados_id_empleado_seq',         'empleados',    'id_empleado'],
    ['productos_id_producto_seq',         'productos',    'id_producto'],
    ['toppings_id_topping_seq',           'toppings',     'id_topping'],
    ['adiciones_id_adicion_seq',          'adiciones',    'id_adicion'],
    ['configuraciones_id_seq',            'configuraciones', 'id'],
  ];

  for (const [seq, tabla, col] of secuencias) {
    try {
      await prisma.$executeRawUnsafe(
        `SELECT setval('${seq}', COALESCE((SELECT MAX(${col}) FROM "${tabla}"), 1))`
      );
      console.log('  ✅ seq', seq);
    } catch (e) {
      console.log('  ⚠️  seq', seq, '→', e.message);
    }
  }

  console.log('\n✅ Restauración completa');
}

restore().catch(console.error).finally(() => prisma.$disconnect());
