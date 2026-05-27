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

/* ── Estado tienda (computed open/closed) ─────────────────────── */
// Público — calcula si está abierto considerando estado y horario
router.get('/estado-tienda', async (req, res) => {
  try {
    const { hora_apertura, hora_cierre, estado_tienda } = await s.horario();

    let abierto = false;
    if (estado_tienda === 'open') {
      abierto = true;
    } else if (estado_tienda === 'closed') {
      abierto = false;
    } else {
      const ahora    = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }));
      const hora     = ahora.getHours() + ahora.getMinutes() / 60;
      const esLunes  = ahora.getDay() === 1;
      abierto = !esLunes && hora >= hora_apertura && hora < hora_cierre;
    }

    res.json({
      success: true,
      data: {
        abierto,
        estado:         estado_tienda,
        hora_apertura,
        hora_cierre,
        horario: `${hora_apertura}:00 - ${hora_cierre}:00`,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Protegido — cambia solo el estado_tienda
router.patch('/estado-tienda', verifyToken, checkPermiso('ver_dashboard'), async (req, res) => {
  try {
    const { estado } = req.body;
    if (!['schedule', 'open', 'closed'].includes(estado)) {
      return res.status(400).json({ success: false, message: 'Estado inválido. Usar: schedule, open, closed' });
    }
    await s.actualizar('estado_tienda', estado);
    res.json({ success: true, data: { estado } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
