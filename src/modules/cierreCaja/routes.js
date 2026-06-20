const { Router } = require('express');
const controller = require('./controller');
const verifyToken = require('../../middlewares/verifyToken');
const checkPermiso = require('../../middlewares/checkPermiso');

const router = Router();

const auth = [verifyToken, checkPermiso('ver_cierre_caja')];

router.get('/hoy',          ...auth, controller.hoy);
router.post('/base',        ...auth, controller.crearBase);
router.patch('/base',       ...auth, controller.actualizarBase);
router.post('/gasto',       ...auth, controller.agregarGasto);
router.delete('/gasto/:id', ...auth, controller.eliminarGasto);
router.get('/resumen',      ...auth, controller.resumen);

module.exports = router;
