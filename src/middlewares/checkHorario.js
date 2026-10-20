const { horario } = require('../modules/configuracion/service');
const { estadoHorario, formatoHora12 } = require('../utils/horarioTienda');

// Valida el horario al crear un pedido de cliente (POST /ventas/mi-pedido):
//  - Tienda "Abierta", o "Por horario" dentro del horario: pasa normal.
//  - Tienda "Cerrada" (manual): no se aceptan pedidos (403), como siempre.
//  - "Por horario" FUERA de horario: se acepta, pero solo si el cliente
//    marcó en la web que entiende que se empezará a preparar a la hora de
//    apertura (acepto_espera: true). Si no, 409 con el texto del aviso.
//    En ese caso deja en req.pedidoEnEspera la fecha de la próxima apertura:
//    el pedido se guarda con esa fecha (ver ventas/service.js crearMiPedido).
const checkHorario = async (req, res, next) => {
  try {
    const h = await horario();
    const estado = estadoHorario(h);

    if (estado.abierto) return next();

    if (estado.cerradaManual) {
      return res.status(403).json({
        success: false,
        message: 'La tienda está cerrada temporalmente.',
        horario: { apertura: formatoHora12(h.hora_apertura), cierre: formatoHora12(h.hora_cierre) },
      });
    }

    // Fuera de horario: el cliente debe haber aceptado el aviso.
    if (req.body?.acepto_espera !== true) {
      return res.status(409).json({
        success: false,
        codigo: 'REQUIERE_AVISO',
        message: `La tienda está cerrada en este momento. Tu pedido se empezará a preparar ${estado.textoDia} a la ${estado.textoHora}.`,
        data: { texto_dia: estado.textoDia, texto_hora: estado.textoHora, proxima_apertura: estado.proximaApertura },
      });
    }

    req.pedidoEnEspera = { fechaApertura: estado.proximaApertura };
    return next();
  } catch (e) {
    // Si falla la BD, usamos el horario por defecto (1 a 8 PM) y no se
    // aceptan pedidos fuera de él.
    const ahora = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const horaDecimal = ahora.getUTCHours() + ahora.getUTCMinutes() / 60;
    if (horaDecimal >= 13 && horaDecimal < 20) return next();
    return res.status(403).json({ success: false, message: 'Estamos cerrados en este momento.' });
  }
};

module.exports = checkHorario;
