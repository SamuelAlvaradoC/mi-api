// ───────────────────────────────────────────────────────────────────────────
// Horario de la tienda en hora Colombia (America/Bogota, UTC-5 todo el año:
// Colombia no cambia la hora). La tienda abre todos los días de
// hora_apertura a hora_cierre (horas enteras, ej. 13 y 20).
//
// Una sola función para todo el sistema: GET /configuracion/estado-tienda y
// el middleware checkHorario la usan, así nunca calculan distinto.
// ───────────────────────────────────────────────────────────────────────────

const DESFASE_COLOMBIA_MS = 5 * 60 * 60 * 1000;
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** 13 -> "1:00 PM" */
const formatoHora12 = (h) => `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;

/**
 * @param {{ hora_apertura:number, hora_cierre:number, estado_tienda:'open'|'closed'|'schedule' }} horario
 * @param {Date} ahora
 * @returns {{
 *   abierto: boolean,           // ¿se atiende en este momento?
 *   cerradaManual: boolean,     // el admin puso "Cerrada": no se aceptan pedidos
 *   fueraDeHorario: boolean,    // "Por horario" y fuera de horario: se aceptan en espera
 *   proximaApertura: Date|null, // instante (UTC) de la próxima apertura, si está fuera de horario
 *   textoDia: string|null,      // "hoy" o "mañana martes 20"
 *   textoHora: string,          // "1:00 PM"
 * }}
 */
const estadoHorario = ({ hora_apertura, hora_cierre, estado_tienda }, ahora = new Date()) => {
  const textoHora = formatoHora12(hora_apertura);
  const base = { abierto: false, cerradaManual: false, fueraDeHorario: false, proximaApertura: null, textoDia: null, textoHora };

  if (estado_tienda === 'open') return { ...base, abierto: true };
  if (estado_tienda === 'closed') return { ...base, cerradaManual: true };

  // "Ahora" en Colombia: restamos 5 horas y leemos la fecha con getUTC*.
  const co = new Date(ahora.getTime() - DESFASE_COLOMBIA_MS);
  const hora = co.getUTCHours() + co.getUTCMinutes() / 60;
  if (hora >= hora_apertura && hora < hora_cierre) return { ...base, abierto: true };

  // Fuera de horario: antes de abrir es hoy; después de cerrar, mañana.
  const esHoy = hora < hora_apertura;
  const dia = new Date(Date.UTC(co.getUTCFullYear(), co.getUTCMonth(), co.getUTCDate() + (esHoy ? 0 : 1)));
  // La apertura en Colombia (ej. 13:00) es esa hora + 5 en UTC.
  const proximaApertura = new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate(), hora_apertura) + DESFASE_COLOMBIA_MS);
  const textoDia = esHoy ? 'hoy' : `mañana ${DIAS[dia.getUTCDay()]} ${dia.getUTCDate()}`;

  return { ...base, fueraDeHorario: true, proximaApertura, textoDia };
};

module.exports = { estadoHorario, formatoHora12 };
