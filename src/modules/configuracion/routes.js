const { Router } = require('express');
const verifyToken  = require('../../middlewares/verifyToken');
const checkPermiso = require('../../middlewares/checkPermiso');
const s = require('./service');

const router = Router();

// Público — el frontend puede leer el tiempo de espera sin autenticación
router.get('/tiempo-espera', async (req, res) => {
  try {
    const minutos = await s.tiempoEspera();
    res.json({ success: true, data: { minutos } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Solo admin puede cambiar
router.patch('/tiempo-espera', verifyToken, checkPermiso('ver_dashboard'), async (req, res) => {
  try {
    const { minutos } = req.body;
    if (!minutos || isNaN(minutos) || Number(minutos) < 1) {
      return res.status(400).json({ success: false, message: 'Minutos inválidos' });
    }
    await s.actualizar('tiempo_espera', minutos);
    res.json({ success: true, data: { minutos: Number(minutos) } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
