const { Router } = require('express');
const verifyToken  = require('../../middlewares/verifyToken');
const checkPermiso = require('../../middlewares/checkPermiso');
const s = require('./service');

const router = Router();

/* ── Tiempo de espera ─────────────────────────────────────────── */
router.get('/tiempo-espera', async (req, res) => {
  try {
    const minutos = await s.tiempoEspera();
    res.json({ success: true, data: { minutos } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

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

/* ── Horario de atención ──────────────────────────────────────── */
// Público — el catálogo lo necesita sin autenticación
router.get('/horario', async (req, res) => {
  try {
    const data = await s.horario();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.patch('/horario', verifyToken, checkPermiso('ver_dashboard'), async (req, res) => {
  try {
    const { hora_apertura, hora_cierre, estado_tienda } = req.body;

    if (hora_apertura !== undefined) {
      const h = Number(hora_apertura);
      if (isNaN(h) || h < 0 || h > 23) return res.status(400).json({ success: false, message: 'Hora de apertura inválida (0-23)' });
      await s.actualizar('hora_apertura', h);
    }
    if (hora_cierre !== undefined) {
      const h = Number(hora_cierre);
      if (isNaN(h) || h < 0 || h > 23) return res.status(400).json({ success: false, message: 'Hora de cierre inválida (0-23)' });
      await s.actualizar('hora_cierre', h);
    }
    if (estado_tienda !== undefined) {
      if (!['schedule', 'open', 'closed'].includes(estado_tienda)) {
        return res.status(400).json({ success: false, message: 'Estado inválido' });
      }
      await s.actualizar('estado_tienda', estado_tienda);
    }

    const data = await s.horario();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
