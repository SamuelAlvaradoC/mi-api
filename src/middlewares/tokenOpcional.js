const verifyToken = require('./verifyToken');

// Para rutas que funcionan con o sin sesión: si llega un token se valida
// igual que en verifyToken (y deja req.user); si no llega, sigue sin usuario.
const tokenOpcional = (req, res, next) => {
  if (!req.headers['authorization']) return next();
  return verifyToken(req, res, next);
};

module.exports = tokenOpcional;
