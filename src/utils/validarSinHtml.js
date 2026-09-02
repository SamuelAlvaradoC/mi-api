const sanitizeHtml = require('sanitize-html');
const he = require('he');

// Config estricta: cero etiquetas y cero atributos permitidos -- estos son
// campos de texto plano (nombre, observaciones, reseñas, motivos), nunca
// texto enriquecido.
const OPCIONES = { allowedTags: [], allowedAttributes: {} };

// sanitize-html no solo quita tags reales -- tambien escapa como entidades
// cualquier "<"/">"/"&" suelto que NO forme un tag valido, para poder
// reserializar el texto de forma segura (ej: "a < b" -> "a &lt; b"). Eso
// significa que comparar el resultado crudo contra el original daria un
// falso positivo con texto totalmente inocente. Por eso se decodifica el
// resultado de sanitize-html antes de comparar: si despues de decodificar
// las entidades el texto vuelve a ser IGUAL al original, es que no habia
// ningun tag real, solo caracteres sueltos que sanitize-html escapo por
// prudencia. Si sigue siendo distinto, es porque sanitize-html removio
// contenido real (un tag, o el contenido de un <script>/<style>).
const contieneHtml = (valor) => {
  if (typeof valor !== 'string' || valor === '') return false;
  const limpioDecodificado = he.decode(sanitizeHtml(valor, OPCIONES));
  return limpioDecodificado !== valor;
};

// Para usar directo en un .refine() de Zod en un campo de texto libre.
// Deja pasar null/undefined (los .optional()/.nullable() del propio campo
// se encargan de si eso es válido o no).
const noContengaHtml = (valor) => {
  if (valor === null || valor === undefined) return true;
  return !contieneHtml(valor);
};

const MSG_HTML = 'El texto no puede contener etiquetas HTML o código';

module.exports = { contieneHtml, noContengaHtml, MSG_HTML };
