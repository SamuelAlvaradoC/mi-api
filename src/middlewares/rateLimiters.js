const rateLimit = require('express-rate-limit');
const { obtenerIpKeyLimiter } = require('../utils/obtenerIpReal');

// keyGenerator explícito en todos: por defecto express-rate-limit usa
// req.ip, que en este stack (Render detrás de Cloudflare) no identifica
// al cliente real -- ver utils/obtenerIpReal.js para el detalle completo
// del bug y cómo se confirmó.

// Mismo patrón que authLimiter en app.js, pero con ventana de 24h --
// protege contra un script que crea decenas de registros/reseñas falsos
// en poco tiempo. skipFailedRequests: solo cuenta los intentos que SÍ
// terminaron en éxito (2xx) -- un registro rechazado por validación o
// email duplicado no debería gastarle el cupo diario a alguien que solo
// se equivocó al llenar el formulario.
const registroLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 5,
  skipFailedRequests: true,
  keyGenerator: obtenerIpKeyLimiter,
  message: { success: false, message: 'Se alcanzó el límite de registros permitidos hoy desde esta conexión. Intenta de nuevo mañana.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resenaLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 4,
  skipFailedRequests: true,
  keyGenerator: obtenerIpKeyLimiter,
  message: { success: false, message: 'Se alcanzó el límite de reseñas permitidas hoy desde esta conexión. Intenta de nuevo mañana.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { registroLimiter, resenaLimiter };
