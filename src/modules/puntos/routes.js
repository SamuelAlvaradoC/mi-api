const router  = require('express').Router();
const prisma  = require('../../config/prisma');
const verifyToken = require('../../middlewares/verifyToken');
const s = require('./service');

const ok = (res, data) => res.json({ success: true, data });

// Cliente ve sus propios puntos
router.get('/mis-puntos', verifyToken, async (req, res, next) => {
  try {
    const cliente = await prisma.cliente.findFirst({ where: { id_usuario: req.user.id_usuario } });
    if (!cliente) return ok(res, { puntos: 0, saldo_pesos: 0, movimientos: [] });
    ok(res, await s.obtenerPuntos(cliente.id_cliente));
  } catch (e) { next(e); }
});

// Admin ve puntos de cualquier cliente
router.get('/cliente/:id_cliente', verifyToken, async (req, res, next) => {
  try {
    ok(res, await s.obtenerPuntos(Number(req.params.id_cliente)));
  } catch (e) { next(e); }
});

module.exports = router;
