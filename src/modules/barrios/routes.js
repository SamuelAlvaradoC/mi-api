const { Router } = require('express');
const controller  = require('./controller');
const verifyToken = require('../../middlewares/verifyToken');
const checkPermiso = require('../../middlewares/checkPermiso');

const router = Router();

// Públicas (el checkout las necesita sin token)
router.get('/activos', controller.listarActivos);

// Protegidas (admin) — lectura solo exige sesión, escritura exige el permiso
router.get('/',             verifyToken, controller.listar);
router.post('/',            verifyToken, checkPermiso('gestionar_barrios'), controller.crear);
router.get('/:id',          verifyToken, controller.obtener);
router.patch('/:id',        verifyToken, checkPermiso('gestionar_barrios'), controller.actualizar);
router.delete('/:id',       verifyToken, checkPermiso('gestionar_barrios'), controller.eliminar);
router.patch('/:id/estado', verifyToken, checkPermiso('gestionar_barrios'), controller.cambiarEstado);

module.exports = router;
