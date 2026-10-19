const jwt = require('jsonwebtoken');
const { isBlacklisted } = require('../modules/auth/service');
const { motivoSesionInvalida } = require('../utils/sesionUsuario');
const logger = require('../utils/logger');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, data: null, message: 'Token requerido' });
  }

  if (isBlacklisted(token)) {
    return res.status(401).json({ success: false, data: null, message: 'Token invalidado. Inicia sesión nuevamente' });
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, data: null, message: 'Token inválido o expirado' });
  }

  // El token es válido, pero la cuenta pudo cambiar después de emitirlo
  // (desactivada, rol desactivado o rol distinto): esa sesión se corta ya.
  // 401 hace que la web y la app cierren la sesión del dispositivo.
  try {
    const motivo = await motivoSesionInvalida(payload);
    if (motivo) return res.status(401).json({ success: false, data: null, message: motivo });
  } catch (err) {
    logger.error('Error verificando el estado de la sesión', { error: err.message, stack: err.stack, id_usuario: payload.id_usuario });
    return res.status(503).json({ success: false, data: null, message: 'No pudimos verificar tu sesión. Intenta de nuevo.' });
  }

  req.user  = payload;
  req.token = token;
  next();
};

module.exports = verifyToken;
