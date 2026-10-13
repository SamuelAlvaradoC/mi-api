// Corrige pagos/detalle_pagos que no coinciden con su venta (método o montos),
// derivándolos de los campos de la venta con la misma regla que usa la API
// (src/modules/ventas/detallePagos.js).
//
//   node scripts/corregir_detalle_pagos.js                 -> SIMULACIÓN (no escribe nada)
//   node scripts/corregir_detalle_pagos.js --aplicar       -> backup + corrección en UNA transacción
//   --incluir-anuladas                                     -> también ventas anuladas (por defecto se omiten)
//
// El backup (pagos + detalle_pagos actuales de las ventas afectadas) se escribe
// en backups/<fecha>_detalle-pagos/ ANTES de tocar la base.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const prisma = require('../src/config/prisma');
const { detallesEsperados, sincronizarDetallePagos } = require('../src/modules/ventas/detallePagos');

const APLICAR = process.argv.includes('--aplicar');
const INCLUIR_ANULADAS = process.argv.includes('--incluir-anuladas');

const fmt = (n) => `$${Math.round(Number(n)).toLocaleString('es-CO')}`;
const firma = (filas) => filas.map((f) => `${f.nombre}:${Math.round(Number(f.monto))}`).sort().join(' + ');
const fechaCO = (d) => new Date(new Date(d).getTime() - 5 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

const buscarDesalineadas = async (db) => {
  const metodos = await db.metodoPago.findMany();
  const ventas = await db.venta.findMany({
    where: {
      pagos: { some: {} },
      ...(INCLUIR_ANULADAS ? {} : { estado: { nombre_estado: { not: 'anulado' } } }),
    },
    include: { estado: true, pagos: { include: { detallePagos: { include: { metodoPago: true } } } } },
    orderBy: { id_venta: 'asc' },
  });
  const malas = [];
  for (const v of ventas) {
    const actual = v.pagos.flatMap((pg) => pg.detallePagos.map((d) => ({ nombre: d.metodoPago.nombre, monto: d.monto })));
    const esperado = detallesEsperados(v, metodos);
    const totalPagado = v.pagos.reduce((s, pg) => s + Number(pg.total_pagado), 0);
    if (firma(actual) !== firma(esperado) || Math.round(totalPagado) !== Math.round(Number(v.total)) || v.pagos.length > 1) {
      malas.push({ venta: v, actual, esperado, totalPagado });
    }
  }
  return malas;
};

(async () => {
  console.log(`Modo: ${APLICAR ? 'APLICAR' : 'SIMULACIÓN (no se escribe nada)'}${INCLUIR_ANULADAS ? ' + anuladas' : ''}\n`);
  const malas = await buscarDesalineadas(prisma);
  if (malas.length === 0) { console.log('No hay ventas desalineadas.'); return; }

  const multiples = malas.filter((m) => m.venta.pagos.length > 1);
  for (const { venta: v, actual, esperado, totalPagado } of malas) {
    console.log(`#${v.id_venta}  ${fechaCO(v.fecha)}  ${v.estado.nombre_estado.padEnd(9)} ${v.metodo_pago.padEnd(13)} total ${fmt(v.total)}`);
    console.log(`    hoy:     ${firma(actual) || '(sin detalle)'}${Math.round(totalPagado) !== Math.round(Number(v.total)) ? `  (total_pagado ${fmt(totalPagado)})` : ''}`);
    console.log(`    quedará: ${firma(esperado)}`);
  }
  console.log(`\n${malas.length} venta(s) a corregir.`);
  if (multiples.length) {
    // sincronizarDetallePagos trabaja sobre UN pago por venta; si alguna tiene
    // varios, no se adivina cuál conservar.
    console.log(`ABORTADO: ${multiples.map((m) => `#${m.venta.id_venta}`).join(', ')} tiene(n) más de un pago. Revisar a mano.`);
    process.exitCode = 1;
    return;
  }
  if (!APLICAR) { console.log('Simulación terminada. Para aplicar: node scripts/corregir_detalle_pagos.js --aplicar'); return; }

  // Backup ANTES de escribir
  const dir = path.join(__dirname, '..', 'backups', `${new Date().toISOString().slice(0, 10)}_detalle-pagos`);
  fs.mkdirSync(dir, { recursive: true });
  const archivo = path.join(dir, `antes_${Date.now()}.json`);
  fs.writeFileSync(archivo, JSON.stringify(malas.map((m) => ({
    id_venta: m.venta.id_venta,
    pagos: m.venta.pagos.map(({ detallePagos, ...pg }) => ({ ...pg, detallePagos: detallePagos.map(({ metodoPago, ...d }) => d) })),
  })), null, 2));
  console.log(`Backup: ${archivo}`);

  // Todo o nada
  await prisma.$transaction(async (tx) => {
    for (const { venta } of malas) await sincronizarDetallePagos(tx, venta);
    const quedan = await buscarDesalineadas(tx);
    if (quedan.length) throw new Error(`Quedaron ${quedan.length} desalineadas tras corregir; se revierte todo.`);
  }, { timeout: 60000 });
  console.log(`Listo: ${malas.length} venta(s) corregidas. Verificación posterior: 0 desalineadas.`);
})()
  .catch((e) => { console.error('ERROR (no se aplicó nada):', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
