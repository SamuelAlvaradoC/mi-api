const prisma = require('../../config/prisma');

// ───────────────────────────────────────────────────────────────────────────
// Carrito del cliente
//
// El carrito vive en el dispositivo (localStorage en la web, SharedPreferences
// en la app) para que cualquiera pueda armar su pedido sin iniciar sesión.
// Cuando hay sesión, además se guarda aquí (tabla `carritos`) para conservarlo
// entre dispositivos; al iniciar sesión el cliente combina el local con este.
//
// Formato de cada línea (el mismo que se manda al crear el pedido):
//   { id_producto, cantidad, toppings: [{ id_topping, cantidad }],
//     adiciones: [{ id_adicion, cantidad }], salsas: [string],
//     chocolate, frutas, observacion }
// Nunca se guardan precios: se recalculan con validar().
// ───────────────────────────────────────────────────────────────────────────

// Mismas reglas de precio que ventas/service.js crear():
const PRECIO_TOPPING_EXTRA = 2000;
const SALSAS_GRATIS = 2;
const PRECIO_SALSA_EXTRA = 5000;

const obtener = async (id_usuario) => {
  const c = await prisma.carritoGuardado.findUnique({ where: { id_usuario } });
  return { items: Array.isArray(c?.items) ? c.items : [] };
};

const guardar = async (id_usuario, items) => {
  await prisma.carritoGuardado.upsert({
    where: { id_usuario },
    create: { id_usuario, items },
    update: { items },
  });
  return { items };
};

/**
 * Revalida cada línea contra la base: producto activo, toppings y adiciones
 * activos, permisos (chocolate/salsas/frutas) y precio actual. Devuelve cada
 * línea "reconstruida" con nombres, precios e imágenes actuales, para que el
 * cliente actualice su carrito (y también para armarlo desde el servidor).
 *
 * Por línea: { disponible, cambios: [texto], producto, toppings, adiciones,
 *   salsas, chocolate, frutas, observacion, cantidad, cargo_extra,
 *   precio_unitario }
 *   - cargo_extra:     toppings extra + salsas extra (por unidad)
 *   - precio_unitario: precio + cargo_extra + adiciones (por unidad)
 */
const validar = async (items) => {
  const ids = (k, sub) => [...new Set(items.flatMap((i) => (sub ? (i[sub] || []).map((x) => x[k]) : [i[k]])))];
  const [productos, toppings, adiciones] = await Promise.all([
    prisma.producto.findMany({ where: { id_producto: { in: ids('id_producto') } } }),
    prisma.topping.findMany({ where: { id_topping: { in: ids('id_topping', 'toppings') } } }),
    prisma.adicion.findMany({ where: { id_adicion: { in: ids('id_adicion', 'adiciones') } } }),
  ]);
  const P = Object.fromEntries(productos.map((p) => [p.id_producto, p]));
  const T = Object.fromEntries(toppings.map((t) => [t.id_topping, t]));
  const A = Object.fromEntries(adiciones.map((a) => [a.id_adicion, a]));

  const lineas = items.map((item) => {
    const p = P[item.id_producto];
    if (!p || p.estado !== 1) {
      return { ...item, disponible: false, cambios: [`${p?.nombre || 'Un producto'} ya no está disponible`] };
    }
    const cambios = [];

    const toppingsOk = [];
    for (const t of item.toppings || []) {
      const db = T[t.id_topping];
      if (!db || db.estado !== 1) { cambios.push(`El topping ${db?.nombre || 'elegido'} ya no está disponible y se quitó`); continue; }
      toppingsOk.push({ id_topping: db.id_topping, nombre: db.nombre, img: db.img, cantidad: t.cantidad || 1 });
    }

    const adicionesOk = [];
    for (const a of item.adiciones || []) {
      const db = A[a.id_adicion];
      if (!db || db.estado !== 1) { cambios.push(`La adición ${db?.nombre || 'elegida'} ya no está disponible y se quitó`); continue; }
      adicionesOk.push({ id_adicion: db.id_adicion, nombre: db.nombre, img: db.img, precio: Number(db.precio), cantidad: a.cantidad || 1 });
    }

    let chocolate = item.chocolate || null;
    if (chocolate && !p.permite_chocolate) { cambios.push('Ya no se puede elegir chocolate en este producto'); chocolate = null; }
    let frutas = item.frutas || null;
    if (frutas && !p.permite_frutas) { cambios.push('Ya no se pueden elegir frutas en este producto'); frutas = null; }
    let salsas = Array.isArray(item.salsas) ? item.salsas : [];
    // Los bowls usan "salsas" para la cobertura (ver ventas/service.js crear()).
    if (salsas.length > 0 && !p.permite_salsas && !p.es_bowl) { cambios.push('Ya no se pueden elegir salsas en este producto'); salsas = []; }

    const maxIncluidos = p.permite_toppings ? (p.max_toppings || 0) : 0;
    const totalTop = toppingsOk.reduce((s, t) => s + t.cantidad, 0);
    const cargoExtra = Math.max(0, totalTop - maxIncluidos) * PRECIO_TOPPING_EXTRA +
      Math.max(0, salsas.length - SALSAS_GRATIS) * PRECIO_SALSA_EXTRA;
    const precioAdiciones = adicionesOk.reduce((s, a) => s + a.precio * a.cantidad, 0);

    return {
      id_producto: p.id_producto,
      cantidad: item.cantidad,
      toppings: toppingsOk,
      adiciones: adicionesOk,
      salsas, chocolate, frutas,
      observacion: item.observacion || null,
      disponible: true,
      cambios,
      producto: {
        id_producto: p.id_producto, nombre: p.nombre, descripcion: p.descripcion, img: p.img,
        precio: Number(p.precio), permite_toppings: p.permite_toppings, max_toppings: p.max_toppings || 0,
        permite_chocolate: !!p.permite_chocolate, permite_salsas: !!p.permite_salsas,
        permite_frutas: !!p.permite_frutas, es_bowl: !!p.es_bowl, id_categoria: p.id_categoria, estado: p.estado,
      },
      cargo_extra: cargoExtra,
      precio_unitario: Number(p.precio) + cargoExtra + precioAdiciones,
    };
  });

  return { lineas };
};

module.exports = { obtener, guardar, validar };
