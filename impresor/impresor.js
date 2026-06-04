const { io } = require('socket.io-client');
const printer = require('node-printer');

// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN — CAMBIAR ANTES DE USAR
// ═══════════════════════════════════════════════════════════
const NOMBRE_IMPRESORA = 'IMPRESORA_TERMICA'; // ← Cambiar por el nombre real de la impresora
const URL_BACKEND      = 'https://mi-api-qpjo.onrender.com';
// ═══════════════════════════════════════════════════════════

console.log('');
console.log('  ==========================================');
console.log('   CHOCOFRESEO - SISTEMA DE IMPRESIÓN');
console.log('  ==========================================');
console.log('');
console.log('  Impresora :', NOMBRE_IMPRESORA);
console.log('  Servidor  :', URL_BACKEND);
console.log('');

const socket = io(URL_BACKEND, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 3000,
});

socket.on('connect', () => {
  console.log('  ✅ Conectado al servidor ChocoFreseo');
  console.log('  ⏳ Esperando pedidos listos...\n');
});

socket.on('disconnect', () => {
  console.log('  ❌ Desconectado — reconectando...');
});

socket.on('connect_error', (e) => {
  console.log('  ⚠️  Error de conexión:', e.message);
});

socket.on('pedido_listo', async (venta) => {
  console.log(`\n  🎉 PEDIDO LISTO: #${venta.id_venta}`);
  console.log(`     Cliente : ${venta.cliente}`);
  console.log(`     Total   : $${Number(venta.total || 0).toLocaleString('es-CO')}`);
  console.log('     Imprimiendo...');

  try {
    await imprimirComanda(venta);
    console.log('     ✅ Impreso correctamente\n');
  } catch (e) {
    console.log('     ❌ Error al imprimir:', e.message, '\n');
  }
});

function imprimirComanda(venta) {
  return new Promise((resolve, reject) => {
    const linea     = '================================';
    const separador = '--------------------------------';

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

      let lineas = `${d.cantidad}x ${d.producto?.nombre || '—'}`;
      if (salsas)   lineas += `\n   Salsas: ${salsas}`;
      if (toppings) lineas += `\n   Toppings: ${toppings}`;
      if (adiciones) lineas += `\n   +${adiciones}`;
      if (d.chocolate) lineas += `\n   Chocolate: ${d.chocolate}`;
      return lineas;
    }).join('\n');

    const metodoPago = {
      efectivo:      'Efectivo',
      transferencia: 'Transferencia',
      mixto:         'Mixto',
    }[venta.metodo_pago] || venta.metodo_pago || '—';

    const fecha = (() => {
      try {
        return new Date(venta.fecha || Date.now()).toLocaleString('es-CO', {
          timeZone: 'America/Bogota',
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
      } catch { return '—'; }
    })();

    const dirCompleta = [
      venta.direccion,
      venta.barrio,
      venta.ciudad,
    ].filter(Boolean).join(', ');

    const texto = [
      '',
      '         CHOCOFRESEO',
      '        NIT 71799618-9',
      '  Cl. 90 #50D-35, Aranjuez',
      ' Cra. 29 #42-49, Buenos Aires',
      '    WhatsApp: 315-991-46-24',
      linea,
      `PEDIDO #${venta.id_venta}`,
      `Fecha: ${fecha}`,
      linea,
      `Cliente: ${venta.cliente || '—'}`,
      `Tel: ${venta.telefono || '—'}`,
      `Dir: ${dirCompleta || '—'}`,
      venta.referencia ? `Ref: ${venta.referencia}` : null,
      linea,
      'PRODUCTOS:',
      productos,
      separador,
      `Subtotal: $${Number(venta.subtotal || 0).toLocaleString('es-CO')}`,
      `Domicilio: $${Number(venta.costo_domicilio || 0).toLocaleString('es-CO')}`,
      `TOTAL: $${Number(venta.total || 0).toLocaleString('es-CO')}`,
      linea,
      `Pago: ${metodoPago}`,
      venta.metodo_pago === 'mixto'
        ? `  Efectivo: $${Number(venta.monto_efectivo || 0).toLocaleString('es-CO')}\n  Transfer: $${Number(venta.monto_transferencia || 0).toLocaleString('es-CO')}`
        : null,
      venta.observaciones ? `Obs: ${venta.observaciones}` : null,
      linea,
      '     Gracias por tu pedido!',
      '  ChocoFreseo es Puro Freseo',
      '',
      '',
      '',
    ].filter(l => l !== null).join('\n');

    printer.printDirect({
      data:    texto,
      printer: NOMBRE_IMPRESORA,
      type:    'RAW',
      success: (jobID) => { console.log(`     Job ID: ${jobID}`); resolve(jobID); },
      error:   (err)   => reject(new Error(err)),
    });
  });
}

process.on('SIGINT', () => {
  console.log('\n  👋 Cerrando sistema de impresión...');
  socket.disconnect();
  process.exit(0);
});
