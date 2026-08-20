const { Router } = require('express');
const controller = require('./controller');
const verifyToken = require('../../middlewares/verifyToken');

const router = Router();

// ── Catálogo (públicos, sin auth) ───────────────────────
router.get('/catalogo/buscar',         controller.buscar);
router.get('/catalogo/promociones',    controller.promociones);
router.get('/catalogo/mas-pedidos',    controller.masPedidos);
router.get('/catalogo/categorias',     controller.listarCategorias);
router.get('/catalogo/productos',      controller.listarProductos);
router.get('/catalogo/productos/:id',  controller.obtenerProducto);
router.get('/catalogo/toppings',       controller.listarToppingsActivos);
router.get('/catalogo/adiciones',      controller.listarAdicionesActivas);

// ── Carrito (requiere auth) ─────────────────────────────
router.get('/carrito/total',   verifyToken, controller.totalCarrito);
router.get('/carrito',         verifyToken, controller.getCarrito);
router.post('/carrito/agregar',verifyToken, controller.agregarItem);
router.put('/carrito/:id',     verifyToken, controller.actualizarItem);
router.delete('/carrito/:id',  verifyToken, controller.eliminarItem);

module.exports = router;
