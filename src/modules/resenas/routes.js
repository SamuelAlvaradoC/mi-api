const { Router } = require('express');
const controller = require('./controller');
const verifyToken = require('../../middlewares/verifyToken');
const checkPermiso = require('../../middlewares/checkPermiso');
const { resenaLimiter } = require('../../middlewares/rateLimiters');

const router = Router();

router.get('/resumen', controller.resumen);
// El límite va aquí (no en app.js con app.use) porque GET /resumen y GET /
// (listar, admin) comparten el mismo prefijo /api/resenas -- un
// app.use('/api/resenas', ...) los habría limitado a los tres por igual.
router.post('/',       resenaLimiter, controller.crear);
router.get('/',        verifyToken, checkPermiso('ver_dashboard'), controller.listar);

module.exports = router;
