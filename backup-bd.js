const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function backup() {
  const fecha = new Date().toISOString().split('T')[0];
  const dir = path.join(__dirname, 'backups', fecha);
  fs.mkdirSync(dir, { recursive: true });

  const resumen = {};

  async function exportar(nombre, query) {
    try {
      const datos = await query();
      fs.writeFileSync(
        path.join(dir, nombre + '.json'),
        JSON.stringify(datos, null, 2)
      );
      resumen[nombre] = datos.length;
      console.log('✅', nombre, '→', datos.length, 'registros');
    } catch (e) {
      console.log('⚠️ ', nombre, '→', e.message);
      resumen[nombre] = 'ERROR: ' + e.message;
    }
  }

  console.log('📦 Iniciando backup selectivo — ' + fecha);
  console.log('Destino:', dir);
  console.log('─────────────────────────────────────────\n');

  // Catálogo base
  await exportar('roles', () => prisma.rol.findMany({
    include: { rolPermisos: { include: { permiso: true } } },
    orderBy: { id_rol: 'asc' },
  }));

  await exportar('permisos', () => prisma.permiso.findMany({
    orderBy: { id_permiso: 'asc' },
  }));

  await exportar('rol_permisos', () => prisma.rolPermiso.findMany({
    orderBy: { id_rol: 'asc' },
  }));

  // Usuarios staff: solo admin y confirmador_domicilio — deja fuera
  // domiciliarios/cocineros y cualquier cuenta de prueba con dominio
  // @test.com (ej. cuentas de debug que no son staff real).
  const filtroStaff = {
    rol: { nombre: { in: ['admin', 'confirmador_domicilio'] } },
    NOT: { email: { endsWith: '@test.com' } },
  };
  await exportar('usuarios_staff', () => prisma.usuario.findMany({
    where: filtroStaff,
    include: { rol: true },
    orderBy: { id_usuario: 'asc' },
  }));

  await exportar('empleados', () => prisma.empleado.findMany({
    where: { usuario: filtroStaff },
    orderBy: { id_empleado: 'asc' },
  }));

  // Catálogo de productos
  await exportar('categorias', () => prisma.categoria.findMany({
    orderBy: { id_categoria: 'asc' },
  }));

  await exportar('productos', () => prisma.producto.findMany({
    include: { categoria: true },
    orderBy: { id_producto: 'asc' },
  }));

  await exportar('toppings', () => prisma.topping.findMany({
    orderBy: { id_topping: 'asc' },
  }));

  await exportar('adiciones', () => prisma.adicion.findMany({
    orderBy: { id_adicion: 'asc' },
  }));

  // Zonas de cobertura — módulo nuevo, no existía en backups anteriores a agosto 2026
  await exportar('ciudades', () => prisma.ciudad.findMany({
    orderBy: { id_ciudad: 'asc' },
  }));

  await exportar('barrios', () => prisma.barrio.findMany({
    include: { ciudad: true },
    orderBy: { id_barrio: 'asc' },
  }));

  // Lookup tables necesarias para restaurar
  await exportar('estados', () => prisma.estado.findMany({
    orderBy: { id_estado: 'asc' },
  }));

  await exportar('estados_domicilio', () => prisma.estadoDomicilio.findMany({
    orderBy: { id_estado_domicilio: 'asc' },
  }));

  // Configuración del sistema
  await exportar('configuracion', () => prisma.configuracion.findMany({
    orderBy: { id: 'asc' },
  }));

  // NOTA: cierre_caja y gastos_dia se dejan fuera de este backup a propósito
  // (decisión 2026-08-03) — es un backup de arranque limpio para reiniciar
  // el aplicativo desde cero en ventas, y el cierre de caja es historial
  // operativo del día a día, no catálogo/config base.

  // Resumen
  fs.writeFileSync(
    path.join(dir, '_resumen.json'),
    JSON.stringify({ fecha, ...resumen }, null, 2)
  );

  console.log('\n─────────────────────────────────────────');
  console.log('✅ Backup completo en:', dir);
  console.log('Tablas exportadas:', Object.keys(resumen).length);
}

backup().catch(console.error).finally(() => prisma.$disconnect());
