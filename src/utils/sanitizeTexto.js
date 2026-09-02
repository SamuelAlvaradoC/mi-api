const sanitizeHtml = require('sanitize-html');

// Config estricta: cero etiquetas y cero atributos permitidos -- estos son
// campos de texto plano (nombre, observaciones, reseñas, motivos), nunca
// texto enriquecido. sanitize-html solo toca lo que realmente parsea como
// HTML (ej. <script>, <img onerror=...>); texto normal como "a < b" o "<3"
// no es sintaxis de tag válida y queda intacto.
const OPCIONES = { allowedTags: [], allowedAttributes: {} };

// Para usar dentro de un .transform() de Zod en un campo de texto libre.
// Limpia el HTML y recorta espacios sobrantes que pueda dejar el proceso.
const sanitizeTexto = (valor) => {
  if (typeof valor !== 'string') return valor;
  return sanitizeHtml(valor, OPCIONES).trim();
};

// Igual que sanitizeTexto, pero preserva null/undefined tal cual (para
// campos .optional().nullable() donde no queremos convertir null en '').
const sanitizeTextoOpcional = (valor) => {
  if (valor === null || valor === undefined || valor === '') return valor;
  return sanitizeTexto(valor);
};

// Para encadenar como .refine() DESPUÉS de .transform(sanitizeTexto) en
// campos requeridos (ej. nombre, motivo de anulación). Necesario porque
// Zod valida .min() ANTES de correr el transform: un valor como
// "<script></script>" (18 caracteres) pasa cualquier mínimo de longitud,
// pero queda vacío después de sanitizar. Este refine cierra ese hueco.
const noQuedeVacioTrasSanitizar = (valor) => valor.length > 0;

module.exports = { sanitizeTexto, sanitizeTextoOpcional, noQuedeVacioTrasSanitizar };
