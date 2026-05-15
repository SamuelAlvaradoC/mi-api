const { horario } = require('../modules/configuracion/service');

const checkHorario = async (req, res, next) => {
  try {
    const { hora_apertura, hora_cierre, estado_tienda } = await horario();

    // Toggle manual: forzar abierto o cerrado
    if (estado_tienda === 'open')   return next();
    if (estado_tienda === 'closed') {
      return res.status(403).json({
        success: false,
        message: 'La tienda está cerrada temporalmente.',
        horario: { apertura: `${hora_apertura}:00`, cierre: `${hora_cierre}:00` },
      });
    }

    // Modo horario normal
    const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000); // UTC-5 Colombia
    const horaDecimal = ahora.getUTCHours() + ahora.getUTCMinutes() / 60;
    const abierto = horaDecimal >= hora_apertura && horaDecimal < hora_cierre;

    if (!abierto) {
      const fmt = (h) => `${h % 12 || 12}:00 ${h < 12 ? 'AM' : 'PM'}`;
      return res.status(403).json({
        success: false,
        message: `Estamos cerrados. Nuestro horario es de ${fmt(hora_apertura)} a ${fmt(hora_cierre)}.`,
        horario: { apertura: fmt(hora_apertura), cierre: fmt(hora_cierre) },
      });
    }
    next();
  } catch (e) {
    // Si falla la BD, usamos horario por defecto para no bloquear
    const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const horaDecimal = ahora.getUTCHours() + ahora.getUTCMinutes() / 60;
    if (horaDecimal >= 13 && horaDecimal < 20) return next();
    return res.status(403).json({ success: false, message: 'Estamos cerrados en este momento.' });
  }
};

module.exports = checkHorario;
