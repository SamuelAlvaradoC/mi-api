const { io }        = require('socket.io-client');
const Jimp           = require('jimp');
const https          = require('https');
const http           = require('http');
const fs             = require('fs');
const path           = require('path');
const os             = require('os');
const { execFile }   = require('child_process');

// ═══════════════════════════════════════════════════════════
// CONFIGURACIÓN — CAMBIAR ANTES DE USAR
// ═══════════════════════════════════════════════════════════
const NOMBRE_IMPRESORA = 'POS Printer 203DPI Series';
const URL_BACKEND      = 'https://mi-api-qpjo.onrender.com';
// ═══════════════════════════════════════════════════════════

const LOGO_URL = 'https://res.cloudinary.com/dnoxlv5kn/image/upload/v1778822634/logo_sin_fondo_remove_uuu8tt.png';

// ── Comandos ESC/POS ────────────────────────────────────────
const ESC = '\x1B';
const GS  = '\x1D';
const INIT        = ESC + '@';        // inicializar impresora
const LATIN1      = ESC + 't\x10';   // code page PC858 (tildes)
const CENTRAR     = ESC + 'a\x01';
const IZQUIERDA   = ESC + 'a\x00';
const NEGRITA_ON  = ESC + 'E\x01';
const NEGRITA_OFF = ESC + 'E\x00';
const DOBLE_ALTO  = GS  + '!\x01';
const NORMAL      = GS  + '!\x00';
const CORTE       = '\n\n\n' + GS + 'V\x41\x00';
// ────────────────────────────────────────────────────────────

// ── Logs ─────────────────────────────────────────────────────
function log(msg) {
  const ts = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const linea = `[${ts}] ${msg}\n`;
  console.log(msg);
  try { fs.appendFileSync(path.join(__dirname, 'logs.txt'), linea, 'utf8'); } catch (_) {}
}
// ────────────────────────────────────────────────────────────

log('');
log('  ==========================================');
log('   CHOCOFRESEO - SISTEMA DE IMPRESION');
log('  ==========================================');
log('');
log('  Impresora : ' + NOMBRE_IMPRESORA);
log('  Servidor  : ' + URL_BACKEND);
log('');

// ── Conversión imagen → ESC/POS raster ──────────────────────
async function imagenAEscPos(url, anchoMax = 200) {
  return new Promise((resolve, reject) => {
    const cliente = url.startsWith('https') ? https : http;
    cliente.get(url, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const img    = await Jimp.read(buffer);

          img.resize(anchoMax, Jimp.AUTO).greyscale().contrast(0.5);

          const ancho       = img.getWidth();
          const alto        = img.getHeight();
          const bytesPerRow = Math.ceil(ancho / 8);

          // GS v 0 — raster bit image
          const header = Buffer.from([
            0x1D, 0x76, 0x30, 0x00,
            bytesPerRow & 0xFF, (bytesPerRow >> 8) & 0xFF,
            alto        & 0xFF, (alto        >> 8) & 0xFF,
          ]);

          const pixeles = [];
          for (let y = 0; y < alto; y++) {
            for (let bx = 0; bx < bytesPerRow; bx++) {
              let byte = 0;
              for (let bit = 0; bit < 8; bit++) {
                const x = bx * 8 + bit;
                if (x < ancho) {
                  const rgba = Jimp.intToRGBA(img.getPixelColor(x, y));
                  const gris = (rgba.r + rgba.g + rgba.b) / 3;
                  if (gris < 128) byte |= (0x80 >> bit);
                }
              }
              pixeles.push(byte);
            }
          }
          resolve(Buffer.concat([header, Buffer.from(pixeles)]));
        } catch (e) { reject(e); }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}
// ────────────────────────────────────────────────────────────

// ── Impresión RAW via PowerShell (sin módulos nativos) ───────
function buildPsScript(binFile, printerName) {
  const bin = binFile.replace(/\\/g, '\\\\');
  const prt = printerName.replace(/'/g, "''");
  return `
$ErrorActionPreference = 'Stop'
$bytes = [System.IO.File]::ReadAllBytes('${bin}')
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrint {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
    [DllImport("winspool.drv", CharSet = CharSet.Auto)]
    public static extern bool OpenPrinter(string n, out IntPtr h, IntPtr d);
    [DllImport("winspool.drv")] public static extern bool ClosePrinter(IntPtr h);
    [DllImport("winspool.drv", CharSet = CharSet.Auto)]
    public static extern bool StartDocPrinter(IntPtr h, int l, DOCINFO d);
    [DllImport("winspool.drv")] public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv")] public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv")] public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv")]
    public static extern bool WritePrinter(IntPtr h, IntPtr p, int c, out int w);
}
"@
\$h = [IntPtr]::Zero
[RawPrint]::OpenPrinter('${prt}', [ref]\$h, [IntPtr]::Zero) | Out-Null
\$di = New-Object RawPrint+DOCINFO; \$di.pDocName = "Comanda"; \$di.pDataType = "RAW"
[RawPrint]::StartDocPrinter(\$h, 1, \$di) | Out-Null
[RawPrint]::StartPagePrinter(\$h) | Out-Null
\$gc = [System.Runtime.InteropServices.GCHandle]::Alloc(\$bytes, [System.Runtime.InteropServices.GCHandleType]::Pinned)
\$w = 0
[RawPrint]::WritePrinter(\$h, \$gc.AddrOfPinnedObject(), \$bytes.Length, [ref]\$w) | Out-Null
\$gc.Free()
[RawPrint]::EndPagePrinter(\$h) | Out-Null
[RawPrint]::EndDocPrinter(\$h) | Out-Null
[RawPrint]::ClosePrinter(\$h) | Out-Null
`.trim();
}

function imprimirRaw(datos, nombreImpresora) {
  return new Promise((resolve, reject) => {
    const id     = Date.now();
    const tmpBin = path.join(os.tmpdir(), `comanda_${id}.bin`);
    const tmpPs  = path.join(os.tmpdir(), `comanda_${id}.ps1`);

    fs.writeFileSync(tmpBin, datos);
    fs.writeFileSync(tmpPs,  buildPsScript(tmpBin, nombreImpresora), 'utf8');

    execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tmpPs],
      { timeout: 30000 },
      (err, _stdout, stderr) => {
        try { fs.unlinkSync(tmpBin); } catch (_) {}
        try { fs.unlinkSync(tmpPs);  } catch (_) {}
        if (err) reject(new Error(stderr || err.message));
        else resolve();
      }
    );
  });
}
// ────────────────────────────────────────────────────────────

// ── Socket ───────────────────────────────────────────────────
const socket = io(URL_BACKEND, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 3000,
});

socket.on('connect',       () => { log('  [OK] Conectado al servidor ChocoFreseo'); log('  [...] Esperando pedidos listos...'); });
socket.on('disconnect',    () => log('  [X] Desconectado - reconectando...'));
socket.on('connect_error', e  => log('  [!] Error de conexion: ' + e.message));

socket.on('pedido_listo', async (venta) => {
  log('');
  log('  PEDIDO LISTO: #' + venta.id_venta);
  log('     Cliente : ' + venta.cliente);
  log('     Total   : $' + Number(venta.total || 0).toLocaleString('es-CO'));
  log('     Imprimiendo...');
  try    { await imprimirComanda(venta); log('     [OK] Impreso correctamente'); }
  catch (e) { log('     [X] Error al imprimir: ' + e.message); }
});

socket.on('reimprimir', async (venta) => {
  log('');
  log('  REIMPRESION: #' + venta.id_venta);
  try    { await imprimirComanda(venta); log('     [OK] Reimpreso correctamente'); }
  catch (e) { log('     [X] Error al reimprimir: ' + e.message); }
});
// ────────────────────────────────────────────────────────────

// ── Comanda ──────────────────────────────────────────────────
async function imprimirComanda(venta) {

  // Logo (con fallback si no hay internet)
  let logoBuffer = Buffer.alloc(0);
  try {
    logoBuffer = await imagenAEscPos(LOGO_URL, 200);
    log('     Logo cargado');
  } catch (e) {
    log('     Logo no disponible: ' + e.message);
  }

  // Productos
  const productosTexto = (venta.detalleVentas || []).map(d => {
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
    let lin = `${d.cantidad}x ${d.producto?.nombre || '-'}`;
    if (salsas)      lin += `\n   Salsas: ${salsas}`;
    if (toppings)    lin += `\n   Toppings: ${toppings}`;
    if (adiciones)   lin += `\n   +${adiciones}`;
    if (d.chocolate) lin += `\n   Chocolate: ${d.chocolate}`;
    return lin;
  }).join('\n');

  const metodoPago = { efectivo: 'Efectivo', transferencia: 'Transferencia', mixto: 'Mixto' }[venta.metodo_pago] || venta.metodo_pago || '-';
  const puntosUsados    = venta.puntos_usados || 0;
  const descuentoPesos  = Number(venta.descuento_puntos) || (puntosUsados * 12.5);
  const puntosGanados   = (venta.puntosGanados ?? venta.puntos_ganados)
    ?? (puntosUsados > 0 ? 0 : Math.floor(Number(venta.subtotal || 0) / 500));
  const puntosTotal     = venta.puntosTotal ?? null;

  const fecha = (() => {
    try {
      return new Date(venta.fecha || Date.now()).toLocaleString('es-CO', {
        timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return '-'; }
  })();

  // Construcción del ticket
  const partes = [
    Buffer.from(INIT + LATIN1),

    // Logo centrado
    Buffer.from(CENTRAR),
    logoBuffer,
    Buffer.from('\n'),

    // Encabezado
    Buffer.from(NEGRITA_ON + DOBLE_ALTO),
    Buffer.from('CHOCOFRESEO\n'),
    Buffer.from(NORMAL + NEGRITA_OFF),
    Buffer.from('NIT 71799618-9\n'),
    Buffer.from('Cl. 90 #50D-35, Aranjuez, Medellin\n'),
    Buffer.from('Cra. 29 #42-49, Buenos Aires, Medellin\n'),
    Buffer.from('WhatsApp: 315-991-46-24\n'),
    Buffer.from('Mar-Dom 1:00 PM - 8:00 PM\n'),

    Buffer.from(IZQUIERDA),
    Buffer.from('================================\n'),

    // Pedido
    Buffer.from(CENTRAR + NEGRITA_ON),
    Buffer.from(`PEDIDO #${venta.id_venta}\n`),
    Buffer.from(NEGRITA_OFF + IZQUIERDA),
    Buffer.from(`${fecha}\n`),
    Buffer.from('================================\n'),

    // Cliente
    Buffer.from(`Cliente: ${venta.cliente || '-'}\n`),
    Buffer.from(`Tel: ${venta.telefono || '-'}\n`),
    Buffer.from(`Dir: ${venta.direccion || '-'}\n`),
    Buffer.from(venta.barrio ? `     ${venta.barrio}${venta.ciudad ? ', ' + venta.ciudad : ''}\n` : ''),
    Buffer.from(venta.referencia ? `Ref: ${venta.referencia}\n` : ''),

    // Productos
    Buffer.from('================================\n'),
    Buffer.from(NEGRITA_ON + 'PRODUCTOS:\n' + NEGRITA_OFF),
    Buffer.from(productosTexto + '\n'),
    Buffer.from('--------------------------------\n'),

    // Totales
    Buffer.from(`Subtotal: $${Number(venta.subtotal || 0).toLocaleString('es-CO')}\n`),
    Buffer.from(descuentoPesos > 0
      ? `Desc. puntos (${puntosUsados} pts): -$${descuentoPesos.toLocaleString('es-CO')}\n`
      : ''),
    Buffer.from(`Domicilio: $${Number(venta.costo_domicilio || 0).toLocaleString('es-CO')}\n`),
    Buffer.from(NEGRITA_ON),
    Buffer.from(`TOTAL: $${Number(venta.total || 0).toLocaleString('es-CO')}\n`),
    Buffer.from(NEGRITA_OFF),

    // Pago
    Buffer.from('================================\n'),
    Buffer.from(`Pago: ${metodoPago}\n`),
    Buffer.from(venta.metodo_pago === 'mixto'
      ? `  Efectivo: $${Number(venta.monto_efectivo || 0).toLocaleString('es-CO')}\n` +
        `  Transf: $${Number(venta.monto_transferencia || 0).toLocaleString('es-CO')}\n`
      : ''),

    // Observaciones
    Buffer.from(venta.observaciones ? `Obs: ${venta.observaciones}\n` : ''),

    // Puntos
    Buffer.from(puntosGanados > 0 || puntosUsados > 0 || puntosTotal !== null
      ? '================================\n' +
        (puntosUsados  > 0 ? `Puntos usados: -${puntosUsados} pts\n`   : '') +
        (puntosGanados > 0 ? `Puntos ganados: +${puntosGanados} pts\n` : '') +
        (puntosTotal   !== null ? `Total puntos: ${puntosTotal} pts\n`  : '')
      : ''),

    // Footer
    Buffer.from(CENTRAR + NEGRITA_ON),
    Buffer.from('================================\n'),
    Buffer.from('¡Gracias por tu pedido!\n', 'latin1'),
    Buffer.from(NEGRITA_OFF),
    Buffer.from('ChocoFreseo es Puro Freseo\n'),

    Buffer.from(CORTE),
  ].filter(b => b.length > 0);

  await imprimirRaw(Buffer.concat(partes), NOMBRE_IMPRESORA);
}
// ────────────────────────────────────────────────────────────

process.on('SIGINT', () => {
  log('');
  log('  Cerrando sistema de impresion...');
  socket.disconnect();
  process.exit(0);
});
