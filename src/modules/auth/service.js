const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../../config/prisma');
const { enviarCodigoRecuperacion } = require('../../utils/mailerGmail');

// ── Tokens en memoria (en prod usar Redis) ─────────────
const resetTokens    = new Map(); // email → { token, expiry }
const blacklistTokens = new Set(); // tokens invalidados por logout

const isBlacklisted = (token) => blacklistTokens.has(token);

// ── Login ───────────────────────────────────────────────
const login = async ({ email, contrasena }) => {
  const usuario = await prisma.usuario.findUnique({ where: { email }, include: { rol: true, cliente: true, empleado: true } });
  if (!usuario) throw { status: 401, message: 'Credenciales inválidas' };
  if (!usuario.estado) throw { status: 403, message: 'Usuario inactivo' };

  const valida = await bcrypt.compare(contrasena, usuario.contrasena);
  if (!valida) throw { status: 401, message: 'Credenciales inválidas' };

  const token = jwt.sign(
    { id_usuario: usuario.id_usuario, id_rol: usuario.id_rol, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  const { contrasena: _, ...datos } = usuario;
  return { token, usuario: datos };
};

// ── Register ────────────────────────────────────────────
const register = async ({ nombre, email, contrasena, id_rol }) => {
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) throw { status: 409, message: 'El email ya está registrado' };

  const hash = await bcrypt.hash(contrasena, 10);
  const rol  = await prisma.rol.findUnique({ where: { id_rol } });

  return prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: { nombre, email, contrasena: hash, id_rol, estado: 1 },
      include: { rol: true },
    });

    if (id_rol === 4 || rol?.nombre === 'cliente') {
      await tx.cliente.create({ data: { id_usuario: usuario.id_usuario } });
    } else if (['domiciliario', 'confirmador_domicilio', 'admin'].includes(rol?.nombre)) {
      await tx.empleado.create({
        data: { id_usuario: usuario.id_usuario, cargo: rol.nombre, fecha_ingreso: new Date(), estado: 1 },
      });
    }

    const { contrasena: _, ...datos } = usuario;
    return datos;
  });
};

// ── Logout ──────────────────────────────────────────────
const logout = (token) => {
  blacklistTokens.add(token);
  return { mensaje: 'Sesión cerrada correctamente' };
};

// ── Recuperar contraseña ────────────────────────────────
const recuperarContrasena = async ({ email }) => {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) throw { status: 404, message: 'Email no registrado' };

  const token = crypto.randomBytes(32).toString('hex');
  resetTokens.set(email, { token, expiry: Date.now() + 3600_000 }); // 1 hora

  // En producción: enviar por email. Aquí lo devolvemos para pruebas.
  return { token, mensaje: 'Token generado. En producción se enviaría por email.' };
};

// ── Solicitar reset con código de 6 dígitos ─────────────
const solicitarReset = async ({ email }) => {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) return { mensaje: 'Si el email existe, recibirás un código en breve.' };

  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  resetTokens.set(email, { token: codigo, expiry: Date.now() + 15 * 60_000 }); // 15 min

  let emailEnviado = false;
  try {
    await enviarCodigoRecuperacion(email, codigo);
    emailEnviado = true;
  } catch (err) {
    console.error('Error al enviar email de recuperación:', err?.message || err);
  }

  const resp = {
    mensaje: emailEnviado
      ? 'Código enviado a tu correo electrónico'
      : 'No se pudo enviar el email — usa el código de desarrollo',
  };
  // En desarrollo: devolver el código si el email falló. En producción: nunca exponer el código.
  if (!emailEnviado && process.env.NODE_ENV !== 'production') resp.dev_token = codigo;
  return resp;
};

// ── Verificar código y cambiar contraseña ───────────────
const verificarReset = async ({ email, codigo, nueva_password }) => {
  const entry = resetTokens.get(email);
  if (!entry || entry.token !== codigo || entry.expiry <= Date.now()) {
    throw { status: 400, message: 'Código inválido o expirado' };
  }

  const hash = await bcrypt.hash(nueva_password, 10);
  await prisma.usuario.update({ where: { email }, data: { contrasena: hash } });
  resetTokens.delete(email);
  return { mensaje: 'Contraseña actualizada correctamente' };
};

// ── Cambiar contraseña (con token de recuperación) ──────
const cambiarContrasena = async ({ token, nueva_contrasena }) => {
  let emailEncontrado = null;
  for (const [email, data] of resetTokens.entries()) {
    if (data.token === token && data.expiry > Date.now()) {
      emailEncontrado = email;
      break;
    }
  }
  if (!emailEncontrado) throw { status: 400, message: 'Token inválido o expirado' };

  const hash = await bcrypt.hash(nueva_contrasena, 10);
  await prisma.usuario.update({ where: { email: emailEncontrado }, data: { contrasena: hash } });
  resetTokens.delete(emailEncontrado);
  return { mensaje: 'Contraseña actualizada correctamente' };
};

// ── Perfil ──────────────────────────────────────────────
const getPerfil = async (id_usuario) => {
  const u = await prisma.usuario.findUnique({
    where: { id_usuario },
    select: { id_usuario: true, nombre: true, email: true, estado: true, fecha_registro: true,
      id_rol: true, rol: true, cliente: true, empleado: true },
  });
  if (!u) throw { status: 404, message: 'Usuario no encontrado' };
  return {
    ...u,
    telefono:  u.cliente?.telefono || null,
    ciudad:    u.cliente?.ciudad   || null,
    barrio:    u.cliente?.barrio   || null,
    id_cliente: u.cliente?.id_cliente || null,
  };
};

// ── Editar perfil ───────────────────────────────────────
const editarPerfil = async (id_usuario, { nombre, email, telefono }) => {
  const data = {};
  if (nombre !== undefined) data.nombre = nombre;
  if (email  !== undefined) data.email  = email;

  const usuario = await prisma.usuario.update({
    where: { id_usuario },
    data,
    select: { id_usuario: true, nombre: true, email: true, estado: true, fecha_registro: true, rol: true },
  });

  let telefonoActual = null;
  if (telefono !== undefined) {
    const cliente = await prisma.cliente.upsert({
      where:  { id_usuario },
      update: { telefono },
      create: { id_usuario, telefono },
    }).catch(() => null);
    telefonoActual = cliente?.telefono ?? telefono;
  } else {
    const cliente = await prisma.cliente.findUnique({ where: { id_usuario }, select: { telefono: true } }).catch(() => null);
    telefonoActual = cliente?.telefono ?? null;
  }

  return { ...usuario, telefono: telefonoActual };
};

// ── Desactivar cuenta ───────────────────────────────────
const desactivarCuenta = async (id_usuario) => {
  return prisma.usuario.update({
    where: { id_usuario },
    data: { estado: 0 },
    select: { id_usuario: true, nombre: true, email: true, estado: true },
  });
};

module.exports = { login, register, logout, recuperarContrasena, cambiarContrasena,
  solicitarReset, verificarReset,
  getPerfil, editarPerfil, desactivarCuenta, isBlacklisted };
