const { Router } = require('express');
const controller = require('./controller');
const verifyToken = require('../../middlewares/verifyToken');
const checkPermiso = require('../../middlewares/checkPermiso');

const router = Router();

const ver      = checkPermiso('ver_clientes');
const gestionar = checkPermiso('gestionar_clientes');

router.get('/buscar',                  verifyToken, ver,       controller.buscar);
router.get('/',                        verifyToken, ver,       controller.listar);
router.post('/',                       verifyToken, gestionar, controller.crear);
router.get('/:id',                     verifyToken, ver,       controller.obtener);
router.put('/:id',                     verifyToken, gestionar, controller.actualizar);
router.delete('/:id',                  verifyToken, gestionar, controller.eliminar);
router.patch('/:id/estado',            verifyToken, gestionar, controller.cambiarEstado);
router.get('/:id/historial-pedidos',   verifyToken, ver,       controller.historialPedidos);
router.get('/:id/toppings-favoritos',  verifyToken, ver,       controller.toppingsFavoritos);
router.get('/:id/adiciones-favoritas', verifyToken, ver,       controller.adicionesFavoritas);
router.get('/:id/perfil',              verifyToken, ver,       controller.perfil);
router.get('/:id/detalle',             verifyToken, ver,       controller.detalleAdmin);
router.get('/:id/direcciones',         verifyToken, ver,       controller.listarDirecciones);
router.post('/:id/direcciones',        verifyToken, gestionar, controller.crearDireccion);

module.exports = router;
