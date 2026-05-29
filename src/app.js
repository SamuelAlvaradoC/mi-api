require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
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

// Health check
app.get('/', (req, res) => res.json({ success: true, data: null, message: 'ChocoAdmin API running' }));

// ── Rutas ───────────────────────────────────────────────
app.use('/api/auth',          require('./modules/auth/routes'));
app.use('/api/roles',         require('./modules/roles/routes'));
app.use('/api/dashboard',     require('./modules/dashboard/routes'));
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
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ success: false, data: null, message: err.message || 'Error interno del servidor' });
});

module.exports = app;
