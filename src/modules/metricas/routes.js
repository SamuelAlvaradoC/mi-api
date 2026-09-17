const { Router } = require('express');
const controller = require('./controller');
const verifyToken = require('../../middlewares/verifyToken');
const checkPermiso = require('../../middlewares/checkPermiso');

const router = Router();

// Permiso exclusivo -- NO reutilizar ver_dashboard: confirmador_domicilio ya
// tiene ese permiso asignado hoy en producción, y esta sección debe quedar
// solo para admin.
const auth = [verifyToken, checkPermiso('ver_metricas')];

router.get('/resumen',              ...auth, controller.resumen);
router.get('/registros',            ...auth, controller.registros);
router.get('/clientes-frecuencia',  ...auth, controller.clientesFrecuencia);

module.exports = router;
