const prisma = require('../../config/prisma');

// Toppings y adiciones de los ítems de un pedido.
//
// El schema acepta cada topping/adición como número (id) o como
// { id, cantidad }; aquí se dejan todos como objeto y se comprueba contra la
// base que existan (y, al crear un pedido, que estén activos). Antes un id
// inexistente terminaba en un 500 (llave foránea, o precio NaN en las
// adiciones) y uno inactivo se aceptaba igual.

const comoObjeto = (x, campo) =>
  typeof x === 'number' ? { [campo]: x, cantidad: 1 } : { ...x, cantidad: x.cantidad || 1 };

/**
 * @param items  ítems del pedido (ya validados por zod)
 * @param {{ exigirActivos: boolean }} opciones  true al crear; false al editar
 *   un pedido existente (puede tener extras que se desactivaron después).
 * @returns {{ items, precioA }} ítems normalizados y precio por id de adición
 */
const validarExtras = async (items, { exigirActivos }) => {
  const normalizados = items.map((item) => ({
    ...item,
    toppings:  (item.toppings  || []).map((t) => comoObjeto(t, 'id_topping')),
    adiciones: (item.adiciones || []).map((a) => comoObjeto(a, 'id_adicion')),
  }));

  const idsT = [...new Set(normalizados.flatMap((i) => i.toppings.map((t) => t.id_topping)))];
  const idsA = [...new Set(normalizados.flatMap((i) => i.adiciones.map((a) => a.id_adicion)))];
  const [toppings, adiciones] = await Promise.all([
    idsT.length ? prisma.topping.findMany({ where: { id_topping: { in: idsT } }, select: { id_topping: true, nombre: true, estado: true } }) : [],
    idsA.length ? prisma.adicion.findMany({ where: { id_adicion: { in: idsA } }, select: { id_adicion: true, nombre: true, estado: true, precio: true } }) : [],
  ]);
  const T = new Map(toppings.map((t) => [t.id_topping, t]));
  const A = new Map(adiciones.map((a) => [a.id_adicion, a]));

  for (const id of idsT) {
    const t = T.get(id);
    if (!t) throw { status: 400, message: `El topping ${id} no existe` };
    if (exigirActivos && Number(t.estado) !== 1) throw { status: 400, message: `El topping "${t.nombre}" ya no está disponible` };
  }
  for (const id of idsA) {
    const a = A.get(id);
    if (!a) throw { status: 400, message: `La adición ${id} no existe` };
    if (exigirActivos && Number(a.estado) !== 1) throw { status: 400, message: `La adición "${a.nombre}" ya no está disponible` };
  }

  const precioA = Object.fromEntries(adiciones.map((a) => [a.id_adicion, Number(a.precio)]));
  return { items: normalizados, precioA };
};

module.exports = { validarExtras };
