const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const { enviarCodigoRecuperacion, enviarBienvenida, enviarAlertaLogin } = require('../../utils/mailer');
const logger = require('../../utils/logger');
const { limpiarCacheSesiones } = require('../../utils/sesionUsuario');
const google = require('./google');

// ── Tokens en memoria (en prod usar Redis) ─────────────
const resetTokens      = new Map(); // email → { token, expiry }
const blacklistTokens  = new Set(); // tokens invalidados por logout
const intentosFallidos = new Map(); // email → cantidad de códigos incorrectos seguidos

const isBlacklisted = (token) => blacklistTokens.has(token);

// Purga periódica de tokens ya expirados en la blacklist, para que el Set
// no crezca indefinidamente con tokens que de todas formas jwt.verify ya rechazaría
setInterval(() => {
  for (const token of blacklistTokens) {
    try {
      jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      if (e.name === 'TokenExpiredError') blacklistTokens.delete(token);
    }
  }
}, 60 * 60 * 1000).unref(); // cada hora; unref: no mantiene vivo el proceso (tests)

// Máximo de IPs recordadas por usuario (evita que el arreglo crezca sin límite)
const MAX_IPS_CONOCIDAS = 10;

// ── Sesión ──────────────────────────────────────────────
// JWT + alerta por correo si la IP es nueva. Lo comparten el login con
// contraseña y el de Google.
const emitirSesion = async (usuario, ip, { alertarIpNueva = true } = {}) => {
  const token = jwt.sign(
    { id_usuario: usuario.id_usuario, id_rol: usuario.id_rol, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  const { contrasena: _, google_sub: __, ...datos } = usuario;

  // Alerta de login para TODOS los roles, pero solo si la IP no es una de
  // las ya conocidas para este usuario (evita mandar correo en cada login
  // normal desde el mismo lugar de siempre).
  const ipsConocidas = usuario.ips_conocidas || [];
  const esIpNueva = !!ip && !ipsConocidas.includes(ip);
  if (esIpNueva) {
    if (alertarIpNueva) {
      enviarAlertaLogin(usuario.email, usuario.nombre)
        .catch(e => logger.error('Error enviando alerta de login', { error: e.message, stack: e.stack, email: usuario.email }));
    }
    // Esta sí se espera (a diferencia del correo): si no queda guardada antes
    // de responder, el siguiente login rápido desde la misma IP volvería a
    // leer el arreglo viejo y mandaría una alerta duplicada.
    const nuevasIps = [...ipsConocidas, ip].slice(-MAX_IPS_CONOCIDAS);
    await prisma.usuario.update({ where: { id_usuario: usuario.id_usuario }, data: { ips_conocidas: nuevasIps } })
      .catch(e => logger.error('Error guardando IP conocida', { error: e.message, stack: e.stack, id_usuario: usuario.id_usuario }));
  }

  return { token, usuario: datos };
};

// ── Login ───────────────────────────────────────────────
const MSG_CUENTA_GOOGLE = "Esta cuenta usa Google para iniciar sesión. Toca 'Continuar con Google' o crea una contraseña desde '¿Olvidaste tu contraseña?'";

const login = async ({ email, contrasena, ip }) => {
  const usuario = await prisma.usuario.findUnique({ where: { email }, include: { rol: true, cliente: true, empleado: true } });
  if (!usuario) throw { status: 401, message: 'Credenciales inválidas' };
  if (!usuario.estado) throw { status: 403, message: 'Usuario inactivo. Por favor, contáctate con el administrador.' };
  if (!usuario.rol?.estado) throw { status: 403, message: 'Tu rol se encuentra inactivo. Por favor, contáctate con el administrador.' };
  // Cuenta conectada a Google sin contraseña propia: su contraseña es
  // aleatoria y nadie la conoce, así que en vez de "credenciales inválidas"
  // se le indica cómo entrar. Revela que el correo existe, igual que ya lo
  // hacen el registro (409) y la recuperación de contraseña (404).
  if (usuario.tiene_contrasena === false) throw { status: 401, message: MSG_CUENTA_GOOGLE };

  const valida = await bcrypt.compare(contrasena, usuario.contrasena);
  if (!valida) throw { status: 401, message: 'Credenciales inválidas' };

  return emitirSesion(usuario, ip);
};

// ── Continuar con Google (solo clientes, web) ───────────
const MSG_SOLO_CONTRASENA = 'Esta cuenta debe ingresar con correo y contraseña';

// Contraseña que nadie conoce: para cuentas que solo entran con Google.
const hashAleatorio = () => bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);

// Nombre de Google sin caracteres de etiquetas HTML; si queda muy corto, la
// parte del correo antes de la @.
const nombreDesdeGoogle = (nombre, email) => {
  const limpio = String(nombre || '').replace(/[<>]/g, '').trim().slice(0, 100);
  return limpio.length >= 2 ? limpio : email.split('@')[0].slice(0, 100);
};

/**
 * @returns {{ token, usuario, vinculada, nueva }}
 *   vinculada: true la primera vez que una cuenta existente se conecta con
 *   Google (la web muestra el aviso); nueva: true si se creó la cuenta.
 */
const loginConGoogle = async ({ credential, ip }) => {
  const g = await google.verificarCredencial(credential);
  const incluir = { rol: true, cliente: true, empleado: true };

  let usuario = await prisma.usuario.findUnique({ where: { google_sub: g.sub }, include: incluir })
             || await prisma.usuario.findUnique({ where: { email: g.email }, include: incluir });

  if (usuario) {
    // Admin, empleados, cocina, confirmador y domiciliarios (activos o no)
    // entran solo con contraseña: ni sesión, ni vinculación, ni cuenta nueva.
    if (usuario.rol?.nombre !== 'cliente' || usuario.empleado) throw { status: 403, message: MSG_SOLO_CONTRASENA };
    if (!usuario.estado) throw { status: 403, message: 'Usuario inactivo. Por favor, contáctate con el administrador.' };
    if (!usuario.rol?.estado) throw { status: 403, message: 'Tu rol se encuentra inactivo. Por favor, contáctate con el administrador.' };

    if (usuario.google_sub && usuario.google_sub !== g.sub) {
      throw { status: 409, message: 'Este correo ya está conectado con otra cuenta de Google' };
    }

    if (!usuario.google_sub) {
      // Primera vez: se vincula y la contraseña anterior deja de funcionar
      // (quien registró ese correo sin ser su dueño pierde el acceso). Si
      // quiere contraseña, la crea con "¿Olvidaste tu contraseña?". Sin
      // correo: el aviso se muestra en pantalla.
      usuario = await prisma.usuario.update({
        where: { id_usuario: usuario.id_usuario },
        data: { google_sub: g.sub, contrasena: await hashAleatorio(), tiene_contrasena: false },
        include: incluir,
      });
      limpiarCacheSesiones();
      const sesion = await emitirSesion(usuario, ip, { alertarIpNueva: false });
      return { ...sesion, vinculada: true, nueva: false };
    }

    return { ...(await emitirSesion(usuario, ip)), vinculada: false, nueva: false };
  }

  // Correo nuevo: cliente con nombre y correo de Google y sus 200 puntos.
  const nombre = nombreDesdeGoogle(g.nombre, g.email);
  const contrasena = await hashAleatorio();
  const creado = await prisma.$transaction(async (tx) => {
    const u = await tx.usuario.create({
      data: { nombre, email: g.email, contrasena, id_rol: ID_ROL_CLIENTE, estado: 1,
              google_sub: g.sub, tiene_contrasena: false },
    });
    await darBienvenidaCliente(tx, u.id_usuario);
    return u;
  });
  enviarBienvenida(g.email, nombre)
    .catch(e => logger.error('Error enviando email de bienvenida', { error: e.message, stack: e.stack, email: g.email }));

  const usuarioNuevo = await prisma.usuario.findUnique({ where: { id_usuario: creado.id_usuario }, include: incluir });
  return { ...(await emitirSesion(usuarioNuevo, ip)), vinculada: false, nueva: true };
};

// ── Register ────────────────────────────────────────────
// Registro público: SIEMPRE crea un cliente (id_rol 4), sin importar lo que
// mande el cliente. Admin, domiciliarios, cocina, etc. se crean solo desde
// el panel de administración (módulos usuarios/empleados, con permisos).
const ID_ROL_CLIENTE = 4;
const PUNTOS_BIENVENIDA = 200;

// Perfil de cliente con sus puntos de bienvenida (una sola vez: solo se
// llama al CREAR la cuenta, nunca al iniciar sesión ni al vincular Google).
const darBienvenidaCliente = async (tx, id_usuario) => {
  const nuevoCliente = await tx.cliente.create({ data: { id_usuario } });
  const puntosReg = await tx.puntosCliente.create({ data: { id_cliente: nuevoCliente.id_cliente, puntos: PUNTOS_BIENVENIDA } });
  await tx.movimientoPuntos.create({
    data: {
      id_puntos:   puntosReg.id_puntos,
      id_venta:    null,
      tipo:        'acumulacion',
      puntos:      PUNTOS_BIENVENIDA,
      descripcion: '¡Bienvenido! 200 puntos de regalo por registrarte',
    },
  });
};

const register = async ({ nombre, email, contrasena }) => {
  const existe = await prisma.usuario.findUnique({ where: { email } });
  if (existe) throw { status: 409, message: 'Ya existe una cuenta con ese correo electrónico. ¿Olvidaste tu contraseña?' };

  const hash = await bcrypt.hash(contrasena, 10);

  const datos = await prisma.$transaction(async (tx) => {
    const usuario = await tx.usuario.create({
      data: { nombre, email, contrasena: hash, id_rol: ID_ROL_CLIENTE, estado: 1 },
      include: { rol: true },
    });

    await darBienvenidaCliente(tx, usuario.id_usuario);

    const { contrasena: _, google_sub: __, ...resto } = usuario;
    return resto;
  });

  // Email de bienvenida (no bloquear si falla)
  enviarBienvenida(email, nombre)
    .catch(e => logger.error('Error enviando email de bienvenida', { error: e.message, stack: e.stack, email }));

  return datos;
};

// ── Logout ──────────────────────────────────────────────
const logout = (token) => {
  blacklistTokens.add(token);
  return { mensaje: 'Sesión cerrada correctamente' };
};

// ── Solicitar reset con código de 6 dígitos ─────────────
const solicitarReset = async ({ email }) => {
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) throw { status: 404, message: 'No existe una cuenta registrada con este correo.' };

  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  resetTokens.set(email, { token: codigo, expiry: Date.now() + 5 * 60_000 }); // 5 min

  let emailEnviado = false;
  try {
    logger.debug('Intentando enviar email de recuperación', {
      email,
      gmailUserConfigurado: !!process.env.GMAIL_USER,
      gmailPassConfigurado: !!process.env.GMAIL_PASS,
    });
    await enviarCodigoRecuperacion(email, codigo);
    emailEnviado = true;
    logger.info('Email de recuperación enviado', { email });
  } catch (err) {
    logger.error('Error enviando email de recuperación (Gmail)', {
      error: err?.message,
      stack: err?.stack,
      code:  err?.code,
      response: err?.response,
      email,
    });
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
  if (!entry || entry.expiry <= Date.now()) {
    throw { status: 400, message: 'Código inválido o expirado' };
  }

  if (entry.token !== codigo) {
    const intentos = (intentosFallidos.get(email) || 0) + 1;
    if (intentos >= 3) {
      resetTokens.delete(email);
      intentosFallidos.delete(email);
      throw { status: 429, message: 'Código inválido 3 veces. Solicita uno nuevo.' };
    }
    intentosFallidos.set(email, intentos);
    throw { status: 400, message: 'Código inválido o expirado' };
  }

  intentosFallidos.delete(email);
  const usuarioActual = await prisma.usuario.findUnique({ where: { email } });
  const igual = await bcrypt.compare(nueva_password, usuarioActual.contrasena);
  if (igual) throw { status: 400, message: 'La nueva contraseña debe ser diferente a la actual' };
  const hash = await bcrypt.hash(nueva_password, 10);
  // Si era una cuenta solo de Google, desde ahora entra de las dos formas.
  await prisma.usuario.update({ where: { email }, data: { contrasena: hash, tiene_contrasena: true } });
  resetTokens.delete(email);
  return { mensaje: 'Contraseña actualizada correctamente' };
};

// ── Perfil ──────────────────────────────────────────────
const getPerfil = async (id_usuario) => {
  const u = await prisma.usuario.findUnique({
    where: { id_usuario },
    select: { id_usuario: true, nombre: true, email: true, estado: true, fecha_registro: true,
      id_rol: true, rol: true, cliente: true, empleado: true, tiene_contrasena: true },
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
  // El correo solo se cambia verificándolo con un código enviado al correo
  // nuevo (POST /auth/cambiar-correo/solicitar y /confirmar). Aquí solo se
  // acepta si es el mismo que ya tiene la cuenta.
  if (email !== undefined) {
    const actual = await prisma.usuario.findUnique({ where: { id_usuario }, select: { email: true } });
    if (actual?.email !== email) {
      throw { status: 400, message: 'Para cambiar tu correo debes verificarlo con el código que te enviamos al correo nuevo' };
    }
    email = undefined;
  }

  // Validar teléfono único si se está cambiando (ignorar vacío)
  if (telefono && telefono.trim() !== '') {
    const telefonoExistente = await prisma.cliente.findFirst({
      where: { telefono: telefono.trim(), NOT: { id_usuario } },
    });
    if (telefonoExistente) throw { status: 409, message: 'Ese número de teléfono ya está registrado en otra cuenta' };
  }

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
    const telefonoNormalizado = telefono.trim() === '' ? null : telefono.trim();
    const cliente = await prisma.cliente.upsert({
      where:  { id_usuario },
      update: { telefono: telefonoNormalizado },
      create: { id_usuario, telefono: telefonoNormalizado },
    }).catch(() => null);
    telefonoActual = cliente?.telefono ?? telefonoNormalizado;
  } else {
    const cliente = await prisma.cliente.findUnique({ where: { id_usuario }, select: { telefono: true } }).catch(() => null);
    telefonoActual = cliente?.telefono ?? null;
  }

  return { ...usuario, telefono: telefonoActual };
};

// ── Desactivar cuenta ───────────────────────────────────
const desactivarCuenta = async (id_usuario) => {
  const usuario = await prisma.usuario.update({
    where: { id_usuario },
    data: { estado: 0 },
    select: { id_usuario: true, nombre: true, email: true, estado: true },
  });
  limpiarCacheSesiones(); // sus sesiones abiertas se cortan ya
  return usuario;
};

module.exports = { login, register, logout, loginConGoogle,
  solicitarReset, verificarReset,
  getPerfil, editarPerfil, desactivarCuenta, isBlacklisted };
