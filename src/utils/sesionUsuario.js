const prisma = require('../config/prisma');

// ───────────────────────────────────────────────────────────────────────────
// Estado actual de la cuenta detrás de un token.
//
// El JWT guarda id_usuario e id_rol al iniciar sesión y dura horas. Para que
// desactivar una cuenta, desactivar su rol o cambiarle el rol corte su sesión
// de inmediato, verifyToken consulta aquí el estado real en cada petición.
//
// Caché corta en memoria (por id_usuario) para no ir a la base en cada
// petición de una misma pantalla. Se vacía entera cuando el admin cambia
// usuarios, clientes, empleados o roles (ver app.js) y cuando un cliente
// desactiva su propia cuenta, así el cambio aplica en la siguiente petición.
// ───────────────────────────────────────────────────────────────────────────

const TTL_MS = 5_000;
const cache = new Map(); // id_usuario -> { valor, vence }

/** { existe, estado, id_rol, rolActivo } de la cuenta, o { existe: false }. */
const estadoCuenta = async (id_usuario) => {
  const ahora = Date.now();
  const enCache = cache.get(id_usuario);
  if (enCache && enCache.vence > ahora) return enCache.valor;

  const u = await prisma.usuario.findUnique({
    where: { id_usuario },
    select: { estado: true, id_rol: true, rol: { select: { estado: true } } },
  });
  const valor = u
    ? { existe: true, estado: Number(u.estado), id_rol: u.id_rol, rolActivo: !!u.rol && Number(u.rol.estado) === 1 }
    : { existe: false };
  cache.set(id_usuario, { valor, vence: ahora + TTL_MS });
  return valor;
};

/**
 * Motivo por el que un token ya no sirve, o null si la sesión sigue válida.
 * @param {{ id_usuario: number, id_rol: number }} payload  contenido del JWT
 */
const motivoSesionInvalida = async (payload) => {
  const c = await estadoCuenta(payload.id_usuario);
  if (!c.existe) return 'Tu cuenta ya no existe. Inicia sesión nuevamente';
  if (c.estado !== 1) return 'Tu cuenta está desactivada. Contáctate con el administrador';
  if (!c.rolActivo) return 'Tu rol se encuentra inactivo. Contáctate con el administrador';
  if (c.id_rol !== payload.id_rol) return 'Tus permisos cambiaron. Inicia sesión nuevamente';
  return null;
};

const limpiarCacheSesiones = () => cache.clear();

module.exports = { motivoSesionInvalida, limpiarCacheSesiones, TTL_MS };
