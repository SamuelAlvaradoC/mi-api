const { io } = require('socket.io-client');
const printer = require('@thiagoelg/node-printer');
const fs      = require('fs');
const path    = require('path');

// ── Comandos ESC/POS ────────────────────────────────────────
const ESC = '\x1B';
const GS  = '\x1D';
const CENTRAR     = ESC + 'a\x01';
const IZQUIERDA   = ESC + 'a\x00';
const NEGRITA_ON  = ESC + 'E\x01';
const NEGRITA_OFF = ESC + 'E\x00';
const DOBLE_ALTO  = GS  + '!\x01';
const NORMAL      = GS  + '!\x00';
const CORTE       = '\n\n\n' + GS + 'V\x41\x00'; // corte parcial
// ────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN — CAMBIAR ANTES DE USAR
// ═══════════════════════════════════════════════════════════
const NOMBRE_IMPRESORA = 'IMPRESORA_TERMICA'; // ← Cambiar por el nombre real
const URL_BACKEND      = 'https://mi-api-qpjo.onrender.com';
// ═══════════════════════════════════════════════════════════

function log(msg) {
  const timestamp = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const linea = `[${timestamp}] ${msg}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(path.join(__dirname, 'logs.txt'), linea, 'utf8');
  } catch (_) {}
}

log('');
log('  ==========================================');
log('   CHOCOFRESEO - SISTEMA DE IMPRESION');
log('  ==========================================');
log('');
log('  Impresora : ' + NOMBRE_IMPRESORA);
log('  Servidor  : ' + URL_BACKEND);
log('');

const socket = io(URL_BACKEND, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 3000,
});

socket.on('connect', () => {
  log('  [OK] Conectado al servidor ChocoFreseo');
  log('  [...] Esperando pedidos listos...');
});

socket.on('disconnect', () => {
  log('  [X] Desconectado - reconectando...');
});

socket.on('connect_error', (e) => {
  log('  [!] Error de conexion: ' + e.message);
});

socket.on('pedido_listo', async (venta) => {
  log('');
  log('  PEDIDO LISTO: #' + venta.id_venta);
  log('     Cliente : ' + venta.cliente);
  log('     Total   : $' + Number(venta.total || 0).toLocaleString('es-CO'));
  log('     Imprimiendo...');

  try {
    await imprimirComanda(venta);
    log('     [OK] Impreso correctamente');
  } catch (e) {
    log('     [X] Error al imprimir: ' + e.message);
  }
});

socket.on('reimprimir', async (venta) => {
  log('');
  log('  REIMPRESION: #' + venta.id_venta);
  try {
    await imprimirComanda(venta);
    log('     [OK] Reimpreso correctamente');
  } catch (e) {
    log('     [X] Error al reimprimir: ' + e.message);
  }
});

function imprimirComanda(venta) {
  return new Promise((resolve, reject) => {

    // ── Productos ──────────────────────────────────────────
    const productos = (venta.detalleVentas || []).map(d => {
      const toppings  = (d.detalleToppings  || []).map(t => t.topping?.nombre).filter(Boolean).join(', ');
      const adiciones = (d.detalleAdiciones || []).map(a => a.adicion?.nombre).filter(Boolean).join(', ');
      const salsas = (() => {
        try {
          const s = d.salsas;
          if (!s) return '';
          const arr = typeof s === 'string' ? JSON.parse(s) : s;
          return arr.map(x => (typeof x === 'object' ? x.nombre : x)).filter(Boolean).join(', ');
        } catch { return ''; }
      })();

      let lineas = `${d.cantidad}x ${d.producto?.nombre || '-'}`;
      if (salsas)      lineas += `\n   Salsas: ${salsas}`;
      if (toppings)    lineas += `\n   Toppings: ${toppings}`;
      if (adiciones)   lineas += `\n   +${adiciones}`;
      if (d.chocolate) lineas += `\n   Chocolate: ${d.chocolate}`;
      return lineas;
    }).join('\n');

    // ── Variables de apoyo ─────────────────────────────────
    const metodoPago = {
      efectivo:      'Efectivo',
      transferencia: 'Transferencia',
      mixto:         'Mixto',
    }[venta.metodo_pago] || venta.metodo_pago || '-';

    const puntosUsados  = venta.puntos_usados || 0;
    const puntosGanados = venta.puntosGanados !== undefined
      ? venta.puntosGanados
      : (puntosUsados > 0 ? 0 : Math.floor(Number(venta.subtotal || 0) / 500));

    const fecha = (() => {
      try {
        return new Date(venta.fecha || Date.now()).toLocaleString('es-CO', {
          timeZone: 'America/Bogota',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
      } catch { return '-'; }
    })();

    // ── Construcción del ticket ────────────────────────────
    const texto = Buffer.concat([

      // Encabezado centrado y negrita
      Buffer.from(CENTRAR + NEGRITA_ON + DOBLE_ALTO),
      Buffer.from('CHOCOFRESEO\n'),
      Buffer.from(NORMAL + NEGRITA_OFF),
      Buffer.from('NIT 71799618-9\n'),
      Buffer.from('Cl. 90 #50D-35, Aranjuez, Medellin\n'),
      Buffer.from('Cra. 29 #42-49, Buenos Aires, Medellin\n'),
      Buffer.from('WhatsApp: 315-991-46-24\n'),
      Buffer.from('Mar-Dom 1:00 PM - 8:00 PM\n'),

      // Separador
      Buffer.from(IZQUIERDA),
      Buffer.from('================================\n'),

      // Número de pedido centrado y negrita
      Buffer.from(CENTRAR + NEGRITA_ON),
      Buffer.from(`PEDIDO #${venta.id_venta}\n`),
      Buffer.from(NEGRITA_OFF + IZQUIERDA),
      Buffer.from(`Fecha: ${fecha}\n`),

      // Separador
      Buffer.from('================================\n'),

      // Datos del cliente
      Buffer.from(`Cliente: ${venta.cliente || '-'}\n`),
      Buffer.from(`Tel: ${venta.telefono || '-'}\n`),
      Buffer.from(`Dir: ${venta.direccion || '-'}\n`),
      Buffer.from(venta.barrio
        ? `     ${venta.barrio}${venta.ciudad ? ', ' + venta.ciudad : ''}\n`
        : ''),
      Buffer.from(venta.referencia ? `Ref: ${venta.referencia}\n` : ''),

      // Separador
      Buffer.from('================================\n'),
      Buffer.from(NEGRITA_ON + 'PRODUCTOS:\n' + NEGRITA_OFF),

      // Productos
      Buffer.from(productos + '\n'),

      // Separador
      Buffer.from('--------------------------------\n'),

      // Totales
      Buffer.from(`Subtotal: $${Number(venta.subtotal || 0).toLocaleString('es-CO')}\n`),
      Buffer.from(`Domicilio: $${Number(venta.costo_domicilio || 0).toLocaleString('es-CO')}\n`),
      Buffer.from(NEGRITA_ON),
      Buffer.from(`TOTAL: $${Number(venta.total || 0).toLocaleString('es-CO')}\n`),
      Buffer.from(NEGRITA_OFF),

      // Separador
      Buffer.from('================================\n'),

      // Pago
      Buffer.from(`Pago: ${metodoPago}\n`),
      Buffer.from(venta.metodo_pago === 'mixto'
        ? `  Efectivo: $${Number(venta.monto_efectivo || 0).toLocaleString('es-CO')}\n` +
          `  Transf: $${Number(venta.monto_transferencia || 0).toLocaleString('es-CO')}\n`
        : ''),

      // Observaciones
      Buffer.from(venta.observaciones ? `Obs: ${venta.observaciones}\n` : ''),

      // Puntos
      Buffer.from(puntosGanados > 0 || puntosUsados > 0
        ? '================================\n' +
          (puntosUsados  > 0 ? `Puntos usados: -${puntosUsados} pts\n`   : '') +
          (puntosGanados > 0 ? `Puntos ganados: +${puntosGanados} pts\n` : '')
        : ''),

      // Footer centrado
      Buffer.from(CENTRAR + NEGRITA_ON),
      Buffer.from('================================\n'),
      Buffer.from('!Gracias por tu pedido!\n'),
      Buffer.from(NEGRITA_OFF),
      Buffer.from('ChocoFreseo es Puro Freseo\n'),

      // Corte de papel
      Buffer.from(CORTE),
    ]);

    printer.printDirect({
      data:    texto,
      printer: NOMBRE_IMPRESORA,
      type:    'RAW',
      success: (jobID) => { log('     Job ID: ' + jobID); resolve(jobID); },
      error:   (err)   => reject(new Error(err)),
    });
  });
}

process.on('SIGINT', () => {
  log('');
  log('  Cerrando sistema de impresion...');
  socket.disconnect();
  process.exit(0);
});
