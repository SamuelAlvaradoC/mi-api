const { Router } = require('express');
const controller = require('./controller');
const verifyToken = require('../../middlewares/verifyToken');
const checkPermiso = require('../../middlewares/checkPermiso');

const router = Router();

router.get('/resumen', controller.resumen);
router.post('/',       controller.crear);
router.get('/',        verifyToken, checkPermiso('ver_dashboard'), controller.listar);

module.exports = router;
