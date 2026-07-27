const { Router } = require('express');
const controller  = require('./controller');
const verifyToken = require('../../middlewares/verifyToken');

const router = Router();

// Públicas (el checkout las necesita sin token)
router.get('/activos', controller.listarActivos);

// Protegidas (admin)
router.get('/',             verifyToken, controller.listar);
router.post('/',            verifyToken, controller.crear);
router.get('/:id',          verifyToken, controller.obtener);
router.patch('/:id',        verifyToken, controller.actualizar);
router.delete('/:id',       verifyToken, controller.eliminar);
router.patch('/:id/estado', verifyToken, controller.cambiarEstado);

module.exports = router;
