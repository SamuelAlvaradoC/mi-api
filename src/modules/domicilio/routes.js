const { Router } = require('express');
const { calcularCostoDomicilio } = require('./calcular');

const router = Router();

router.post('/calcular', async (req, res, next) => {
  try {
    const { lat, lng, ciudad } = req.body;
    if (lat == null || lng == null) {
      return res.status(400).json({ success: false, message: 'lat y lng requeridos' });
    }
    const resultado = await calcularCostoDomicilio(Number(lat), Number(lng), ciudad || '');
    res.json({
      success: true,
      data: {
        costo_domicilio: resultado.costo,
        distancia_km:    resultado.distKm,
        tarifa_por_km:   resultado.tarifa,
        zona:            resultado.esSur ? 'Sur' : 'Norte/Centro',
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
