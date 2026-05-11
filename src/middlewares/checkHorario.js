const checkHorario = (req, res, next) => {
  const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000); // UTC-5 Colombia
  const hora = ahora.getUTCHours();
  const minutos = ahora.getUTCMinutes();
  const horaDecimal = hora + minutos / 60;

  const abierto = horaDecimal >= 13 && horaDecimal < 20;

  if (!abierto) {
    return res.status(403).json({
      success: false,
      message: 'Estamos cerrados. Nuestro horario es de lunes a domingo de 1pm a 8pm.',
      horario: { apertura: '1:00 PM', cierre: '8:00 PM' },
    });
  }
  next();
};

module.exports = checkHorario;
