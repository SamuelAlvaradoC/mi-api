const { Router } = require('express');
const controller = require('./controller');
const verifyToken = require('../../middlewares/verifyToken');
const checkPermiso = require('../../middlewares/checkPermiso');
const { checkPermisoAny } = require('../../middlewares/checkPermiso');
const checkHorario = require('../../middlewares/checkHorario');

const router = Router();

// Estáticas antes de /:id  (rutas de cliente — sin checkPermiso)
router.get('/mis-pedidos',     verifyToken, controller.misVentas);
router.get('/mis-despachos',   verifyToken, controller.misDespachos); // domi: sus ventas despachadas/entregadas
router.post('/mi-pedido',      verifyToken, checkHorario, controller.crearMiPedido);
router.get('/filtrar',         verifyToken, checkPermisoAny('ver_ventas','gestionar_cocina'),         controller.filtrar);
router.get('/',                verifyToken, checkPermisoAny('ver_ventas','gestionar_cocina'),         controller.listar);
router.post('/',               verifyToken, checkPermiso('gestionar_ventas'),                           controller.crear);
router.get('/:id',             verifyToken, checkPermiso('ver_ventas'),                                 controller.obtener);
router.get('/:id/total',       verifyToken, checkPermiso('ver_ventas'),                                 controller.totalVenta);
router.get('/:id/comprobante', verifyToken, checkPermiso('ver_ventas'),                                 controller.comprobante);
router.post('/:id/whatsapp',   verifyToken, checkPermiso('ver_ventas'),                                 controller.whatsapp);
// cambiar_estado_venta (admin) | confirmar_domicilios (confirmador) | facturar_pedido (domi) | gestionar_cocina (cocinero)
router.patch('/:id/estado',    verifyToken, checkPermisoAny('cambiar_estado_venta','confirmar_domicilios','facturar_pedido','gestionar_cocina'),  controller.cambiarEstado);
router.patch('/:id/anular',    verifyToken, checkPermiso('anular_venta'),                               controller.anular);
router.patch('/:id/editar',   verifyToken, checkPermiso('gestionar_ventas'),                              controller.editar);

module.exports = router;
