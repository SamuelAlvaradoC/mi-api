require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const logger    = require('./utils/logger');
const { registroLimiter } = require('./middlewares/rateLimiters');
const { obtenerIpKeyLimiter } = require('./utils/obtenerIpReal');

const app = express();

// Render corre detrás de un proxy -- sin esto, Express ni siquiera intenta
// leer X-Forwarded-For. Pero OJO: Render en realidad está detrás de
// Cloudflare (Cloudflare -> balanceador de Render -> este contenedor, 2
// saltos), y trust proxy=1 solo confía en 1 -- por eso req.ip TODAVÍA
// resuelve una IP interna de la infraestructura de Render, no la del
// cliente real (confirmado con evidencia real, ver utils/obtenerIpReal.js).
// Se deja igual como base para Express, pero el código NO debe usar
// req.ip directamente para identificar clientes -- usar obtenerIpReal(req).
app.set('trust proxy', 1);

// ── Seguridad HTTP ──────────────────────────────────────
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://chocofreseo-web.vercel.app',
    'https://chocofreseo.com',
    'https://www.chocofreseo.com',
  ],
  credentials: true,
}));
app.use(express.json());

// ── Rate limiting ───────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: obtenerIpKeyLimiter,
  message: { success: false, message: 'Demasiados intentos. Espera 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login',           authLimiter);
app.use('/api/auth/solicitar-reset', authLimiter);
app.use('/api/auth/verificar-reset', authLimiter);
app.use('/api/auth/register',        registroLimiter);

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  keyGenerator: obtenerIpKeyLimiter,
  message: { success: false, message: 'Demasiadas solicitudes. Intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
// Límite general de /api SIN rate limit (desactivado temporalmente)
// app.use('/api', generalLimiter);

// Health check
app.get('/', (req, res) => res.json({ success: true, data: null, message: 'ChocoAdmin API running' }));

// ── Rutas ───────────────────────────────────────────────
app.use('/api/auth',          require('./modules/auth/routes'));
app.use('/api/roles',         require('./modules/roles/routes'));
app.use('/api/dashboard',     require('./modules/dashboard/routes'));
app.use('/api/cierre-caja',   require('./modules/cierreCaja/routes'));
app.use('/api/usuarios',      require('./modules/usuarios/routes'));
app.use('/api/categorias',    require('./modules/categorias/routes'));
app.use('/api/toppings',      require('./modules/toppings/routes'));
app.use('/api/adiciones',     require('./modules/adiciones/routes'));
app.use('/api/productos',     require('./modules/productos/routes'));
app.use('/api/clientes',      require('./modules/clientes/routes'));
app.use('/api/empleados',     require('./modules/empleados/routes'));
app.use('/api/ventas',        require('./modules/ventas/routes'));
app.use('/api/pagos',         require('./modules/pagos/routes'));
app.use('/api/domicilios',    require('./modules/domicilios/routes'));
app.use('/api/metodos-pago',  require('./modules/metodos-pago/routes'));
app.use('/api/ciudades',        require('./modules/ciudades/routes'));
app.use('/api/barrios',         require('./modules/barrios/routes'));
app.use('/api/domicilio',      require('./modules/domicilio/routes'));
app.use('/api/resenas',        require('./modules/resenas/routes'));
app.use('/api/configuracion',  require('./modules/configuracion/routes'));
app.use('/api/puntos',         require('./modules/puntos/routes'));
app.use('/api',               require('./modules/catalogo/routes')); // catálogo + carrito

// ── Error handler global ────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.name === 'ZodError') {
    return res.status(422).json({
      success: false,
      data: err.errors.map((e) => ({ campo: e.path.join('.'), mensaje: e.message })),
      message: 'Error de validación',
    });
  }
  if (err.code === 'P2002') {
    const campo = err.meta?.target?.[0] || 'campo';
    return res.status(409).json({ success: false, data: null, message: `Ya existe un registro con ese ${campo}` });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, data: null, message: 'El registro no existe' });
  }
  logger.error('Error no manejado', {
    error:  err.message,
    stack:  err.stack,
    method: req.method,
    url:    req.originalUrl,
  });
  const status = err.status || 500;
  // Solo se devuelve err.message al cliente cuando el error trae `status`
  // explícito (significa que un service lo lanzó a propósito con un mensaje
  // ya pensado para el usuario, ej: { status: 400, message: '...' }). Un
  // error sin `status` es inesperado (bug, excepción de Prisma, etc.) y su
  // .message puede contener detalle técnico interno — nunca se expone,
  // aunque el logger sí guarda el detalle completo arriba.
  const message = err.status ? (err.message || 'Error interno del servidor') : 'Error interno del servidor';
  res.status(status).json({ success: false, data: null, message });
});

module.exports = app;
