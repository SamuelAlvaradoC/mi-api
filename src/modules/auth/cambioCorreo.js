const crypto = require('crypto');
const prisma = require('../../config/prisma');
const { enviarCodigoCambioCorreo, enviarAvisoCambioCorreo } = require('../../utils/mailer');
const logger = require('../../utils/logger');

// ───────────────────────────────────────────────────────────────────────────
// Cambio de correo de la propia cuenta, con verificación.
//
//   1. solicitar(): se manda un código de 6 dígitos al NUEVO correo.
//   2. confirmar(): con ese código se cambia el correo y se avisa al anterior.
//
// Así nadie puede poner en su cuenta un correo que no controla (importante
// para la vinculación con Google por correo). Un correo que ya usa otra
// cuenta se rechaza en los dos pasos. Los códigos viven en memoria, igual que
// los de recuperación de contraseña.
// ───────────────────────────────────────────────────────────────────────────

const VIGENCIA_MS = 10 * 60_000;
const ESPERA_REENVIO_MS = 60_000;
const MAX_INTENTOS = 3;

const pendientes = new Map(); // id_usuario -> { email, codigo, vence, enviado, intentos }

const correoEnUso = async (email, id_usuario) =>
  !!(await prisma.usuario.findFirst({ where: { email, NOT: { id_usuario } }, select: { id_usuario: true } }));

const solicitar = async (id_usuario, email) => {
  const usuario = await prisma.usuario.findUnique({ where: { id_usuario }, select: { email: true } });
  if (!usuario) throw { status: 404, message: 'Usuario no encontrado' };
  if (usuario.email === email) throw { status: 400, message: 'Ese ya es el correo de tu cuenta' };
  if (await correoEnUso(email, id_usuario)) throw { status: 409, message: 'Ese correo electrónico ya está en uso por otra cuenta' };

  const previo = pendientes.get(id_usuario);
  if (previo && Date.now() - previo.enviado < ESPERA_REENVIO_MS) {
    throw { status: 429, message: 'Espera un minuto antes de pedir otro código' };
  }

  const codigo = crypto.randomInt(100000, 1000000).toString();
  pendientes.set(id_usuario, { email, codigo, vence: Date.now() + VIGENCIA_MS, enviado: Date.now(), intentos: 0 });
  try {
    await enviarCodigoCambioCorreo(email, codigo);
  } catch (err) {
    pendientes.delete(id_usuario);
    logger.error('Error enviando código de cambio de correo', { error: err?.message, stack: err?.stack, id_usuario });
    throw { status: 502, message: 'No pudimos enviar el código a ese correo. Revisa que esté bien escrito e intenta de nuevo.' };
  }
  return { mensaje: `Te enviamos un código a ${email}` };
};

const confirmar = async (id_usuario, codigo) => {
  const p = pendientes.get(id_usuario);
  if (!p || p.vence <= Date.now()) {
    pendientes.delete(id_usuario);
    throw { status: 400, message: 'El código venció o no existe. Pide uno nuevo.' };
  }
  if (p.codigo !== codigo) {
    p.intentos += 1;
    if (p.intentos >= MAX_INTENTOS) {
      pendientes.delete(id_usuario);
      throw { status: 429, message: 'Código inválido 3 veces. Pide uno nuevo.' };
    }
    throw { status: 400, message: 'Código inválido' };
  }

  // Se vuelve a revisar: otra cuenta pudo registrarse con ese correo mientras tanto.
  if (await correoEnUso(p.email, id_usuario)) {
    pendientes.delete(id_usuario);
    throw { status: 409, message: 'Ese correo electrónico ya está en uso por otra cuenta' };
  }

  const anterior = await prisma.usuario.findUnique({ where: { id_usuario }, select: { email: true, nombre: true } });
  const usuario = await prisma.usuario.update({
    where: { id_usuario },
    data: { email: p.email },
    select: { id_usuario: true, nombre: true, email: true, estado: true, fecha_registro: true, rol: true },
  });
  pendientes.delete(id_usuario);

  enviarAvisoCambioCorreo(anterior.email, anterior.nombre, p.email)
    .catch((e) => logger.error('Error avisando cambio de correo', { error: e.message, stack: e.stack, id_usuario }));
  return usuario;
};

module.exports = { solicitar, confirmar, _pendientes: pendientes };
