const winston = require('winston');

// Niveles propios (el set por defecto de Winston trae 'verbose'/'silly' que
// no usamos). error=0 es el más severo, debug=4 el más detallado — un
// LOG_LEVEL='info' deja pasar error/warn/info pero filtra http/debug.
const levels = { error: 0, warn: 1, info: 2, http: 3, debug: 4 };

// Solo stdout: Render tiene disco efímero, así que escribir a archivo local
// se pierde en cada reinicio/hibernación. Render captura stdout directamente
// en su propio sistema de logs, y JSON ahí es parseable/buscable.
const logger = winston.createLogger({
  levels,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
