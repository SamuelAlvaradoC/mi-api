require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...\n');

  // ── Roles ──────────────────────────────────────────────
  const rolesData = [
    { nombre: 'admin',                 descripcion: 'Administrador del sistema' },
    { nombre: 'domiciliario',          descripcion: 'Entrega de pedidos a domicilio' },
    { nombre: 'confirmador_domicilio', descripcion: 'Confirma y gestiona el estado de los domicilios' },
    { nombre: 'cliente',               descripcion: 'Cliente de la tienda' },
  ];
  for (const r of rolesData) {
    await prisma.rol.upsert({ where: { id_rol: rolesData.indexOf(r) + 1 }, update: r, create: r }).catch(() =>
      prisma.rol.create({ data: r })
    );
  }
  const roles = await prisma.rol.findMany();
  console.log(`✓ Roles: ${roles.length} disponibles`);

  // ── Permisos (upsert por nombre único) ─────────────────
  // Lista depurada: solo los permisos realmente usados por checkPermiso()/checkPermisoAny()
  // en las rutas, más los conceptuales que el negocio pidió mantener (ver_reportes).
  // NO agregar de vuelta el set legacy en notación punto (clientes.ver, productos.crear, etc.)
  // — se eliminaron el 2026 por duplicar/no usarse, ver commit "limpiar permisos duplicados".
  const permisosList = [
    'ver_dashboard', 'ver_ventas', 'gestionar_ventas',
    'cambiar_estado_venta', 'anular_venta', 'ver_clientes',
    'gestionar_clientes', 'ver_empleados', 'gestionar_empleados',
    'ver_usuarios', 'gestionar_usuarios', 'gestionar_productos',
    'gestionar_categorias', 'gestionar_toppings',
    'gestionar_adiciones', 'gestionar_roles', 'ver_reportes',
    'ver_pedidos_domiciliario', 'facturar_pedido',
    'confirmar_domicilios', 'gestionar_cocina', 'ver_cierre_caja',
    'gestionar_ciudades', 'gestionar_barrios',
    // En uso real por checkPermiso() aunque no están en la lista de negocio de 22:
    'ver_roles',
    'pagos.crear', 'pagos.ver',
    'metodos_pago.listar', 'metodos_pago.crear', 'metodos_pago.editar', 'metodos_pago.estado',
  ];

  for (const nombre of permisosList) {
    await prisma.permiso.upsert({
      where:  { nombre },
      update: { descripcion: nombre },
      create: { nombre, descripcion: nombre },
    });
  }
  console.log(`✓ Permisos: ${permisosList.length} sincronizados`);

  // ── Rol admin → todos los permisos ────────────────────
  const rolAdmin = await prisma.rol.findFirst({ where: { nombre: 'admin' } });
  const todosPermisos = await prisma.permiso.findMany();

  const yaAsignados = await prisma.rolPermiso.findMany({ where: { id_rol: rolAdmin.id_rol }, select: { id_permiso: true } });
  const asignadosSet = new Set(yaAsignados.map((r) => r.id_permiso));
  const nuevos = todosPermisos.filter((p) => !asignadosSet.has(p.id_permiso));

  if (nuevos.length > 0) {
    await prisma.rolPermiso.createMany({
      data: nuevos.map((p) => ({ id_rol: rolAdmin.id_rol, id_permiso: p.id_permiso })),
    });
  }
  console.log(`✓ RolPermisos: admin tiene ${todosPermisos.length} permisos`);

  // ── Rol confirmador_domicilio → permiso cierre de caja ─
  const rolConfirmador = await prisma.rol.findFirst({ where: { nombre: 'confirmador_domicilio' } });
  const permisoCierreCaja = await prisma.permiso.findFirst({ where: { nombre: 'ver_cierre_caja' } });
  if (rolConfirmador && permisoCierreCaja) {
    const yaTiene = await prisma.rolPermiso.findFirst({
      where: { id_rol: rolConfirmador.id_rol, id_permiso: permisoCierreCaja.id_permiso },
    });
    if (!yaTiene) {
      await prisma.rolPermiso.create({
        data: { id_rol: rolConfirmador.id_rol, id_permiso: permisoCierreCaja.id_permiso },
      });
    }
    console.log('✓ RolPermisos: confirmador_domicilio tiene ver_cierre_caja');
  }

  // ── Estados de venta ───────────────────────────────────
  const estadosVenta = ['pendiente', 'en_proceso', 'listo', 'entregado', 'anulado'];
  for (const nombre_estado of estadosVenta) {
    const existe = await prisma.estado.findFirst({ where: { nombre_estado } });
    if (!existe) await prisma.estado.create({ data: { nombre_estado, descripcion: nombre_estado } });
  }
  console.log(`✓ Estados venta: ${estadosVenta.length}`);

  // ── Estados de domicilio ───────────────────────────────
  const estadosDomi = ['asignado', 'en_camino', 'entregado'];
  for (const nombre_estado of estadosDomi) {
    const existe = await prisma.estadoDomicilio.findFirst({ where: { nombre_estado } });
    if (!existe) await prisma.estadoDomicilio.create({ data: { nombre_estado, descripcion: nombre_estado } });
  }
  console.log(`✓ Estados domicilio: ${estadosDomi.length}`);

  // ── Métodos de pago ────────────────────────────────────
  const metodos = [
    { nombre: 'efectivo',      descripcion: 'Pago en efectivo' },
    { nombre: 'transferencia', descripcion: 'Transferencia bancaria' },
    { nombre: 'nequi',         descripcion: 'Pago por Nequi' },
    { nombre: 'daviplata',     descripcion: 'Pago por Daviplata' },
  ];
  for (const m of metodos) {
    const existe = await prisma.metodoPago.findFirst({ where: { nombre: m.nombre } });
    if (!existe) await prisma.metodoPago.create({ data: { ...m, estado: 1 } });
  }
  console.log(`✓ Métodos de pago: ${metodos.length}`);

  // ── Usuario administrador ──────────────────────────────
  const emailAdmin = 'admin@chocoadmin.com';
  const existeAdmin = await prisma.usuario.findUnique({ where: { email: emailAdmin } });
  if (!existeAdmin) {
    const hash = await bcrypt.hash('Admin1234!', 10);
    const u = await prisma.usuario.create({
      data: { nombre: 'Administrador', email: emailAdmin, contrasena: hash, id_rol: rolAdmin.id_rol, estado: 1 },
    });
    await prisma.empleado.create({ data: { id_usuario: u.id_usuario, cargo: 'admin', fecha_ingreso: new Date(), estado: 1 } });
    console.log(`✓ Admin creado → ${emailAdmin} / Admin1234!`);
  } else {
    console.log(`✓ Admin ya existe (${emailAdmin})`);
  }

  console.log('\n Seed completado');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
