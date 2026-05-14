const prisma = require('../../config/prisma');

const includeDetalle = {
  cliente:  { include: { usuario: { select: { nombre: true, email: true } } } },
  estado:   true,
  direccion: true,
  pagos:    { include: { detallePagos: { include: { metodoPago: true } } } },
  detalleVentas: {
    include: {
      producto: true,
      detalleToppings:  { include: { topping: true } },
      detalleAdiciones: { include: { adicion: true } },
    },
  },
};

const listar = async ({ estado, fecha, id_domiciliario } = {}) => {
  const where = {};

  if (estado) {
    const estadoObj = await prisma.estado.findFirst({
      where: { nombre_estado: { equals: estado, mode: 'insensitive' } },
    });
    if (!estadoObj) return [];
    where.id_estado = estadoObj.id_estado;
  }

  if (fecha) {
    const inicio = new Date(fecha + 'T05:00:00.000Z');
    const fin    = new Date(inicio.getTime() + 24 * 60 * 60 * 1000 - 1);
    where.fecha  = { gte: inicio, lte: fin };
  }

  // Filtrar por domiciliario (panel del domi: solo ve sus ventas despachadas/entregadas)
  if (id_domiciliario) {
    where.id_domiciliario = Number(id_domiciliario);
  }

  const orderBy = estado ? { id_venta: 'asc' } : { fecha: 'desc' };
  return prisma.venta.findMany({ where, include: includeDetalle, orderBy });
};

const filtrar = (estadoId) => prisma.venta.findMany({
  where: { id_estado: Number(estadoId) },
  include: includeDetalle,
  orderBy: { fecha: 'desc' },
});

const obtener = async (id) => {
  const v = await prisma.venta.findUnique({ where: { id_venta: id }, include: includeDetalle });
  if (!v) throw { status: 404, message: 'Venta no encontrada' };
  return v;
};

const crear = async ({ id_cliente, id_direccion, nueva_direccion, costo_domicilio = 0, observaciones, items, metodo_pago, monto_efectivo, monto_transferencia, comprobante_url }) => {
  // Si se envía nueva_direccion, crearla antes
  let direccionId = id_direccion;
  if (!direccionId && nueva_direccion) {
    const dir = await prisma.direccion.create({
      data: {
        id_cliente:      id_cliente,
        direccion_linea: nueva_direccion.direccion_linea,
        barrio:          nueva_direccion.barrio       || null,
        ciudad:          nueva_direccion.ciudad       || null,
        departamento:    nueva_direccion.departamento || null,
        referencia:      nueva_direccion.referencia   || null,
        lat:             nueva_direccion.lat          || null,
        lng:             nueva_direccion.lng          || null,
      },
    });
    direccionId = dir.id_direccion;
  }

  const productoIds = items.map((i) => i.id_producto);
  const productos   = await prisma.producto.findMany({ where: { id_producto: { in: productoIds } } });
  const prodData    = Object.fromEntries(productos.map((p) => [p.id_producto, { precio: Number(p.precio), max_toppings: p.max_toppings || 0 }]));

  const adicionIds  = items.flatMap((i) => (i.adiciones || []).map((a) => a.id_adicion));
  const adiciones   = adicionIds.length ? await prisma.adicion.findMany({ where: { id_adicion: { in: adicionIds } } }) : [];
  const precioA     = Object.fromEntries(adiciones.map((a) => [a.id_adicion, Number(a.precio)]));

  let subtotal = 0;
  const itemsCalc = items.map((item) => {
    const pd = prodData[item.id_producto];
    if (!pd) throw { status: 400, message: `Producto ${item.id_producto} no encontrado` };
    const maxTop = item.max_toppings != null ? item.max_toppings : pd.max_toppings;
    const totalTop = (item.toppings || []).reduce((s, t) => s + (typeof t === 'number' ? 1 : (t.cantidad || 1)), 0);
    const toppingExtra = Math.max(0, totalTop - maxTop) * 2000;
    const precioUnitItem = pd.precio + toppingExtra;
    const adicionesCalc = (item.adiciones || []).map((a) => ({
      id_adicion: a.id_adicion, cantidad: a.cantidad,
      precio_unitario: precioA[a.id_adicion],
      subtotal: precioA[a.id_adicion] * a.cantidad,
    }));
    const itemSub = precioUnitItem * item.cantidad + adicionesCalc.reduce((s, a) => s + a.subtotal, 0);
    subtotal += itemSub;
    return { ...item, precio_unitario: precioUnitItem, subtotal: precioUnitItem * item.cantidad, adicionesCalc };
  });

  const estadoPendiente = await prisma.estado.findFirst({ where: { nombre_estado: 'pendiente' } });
  const total           = subtotal + Number(costo_domicilio);

  // Calcular montos según método de pago
  let montoEfectivo = null;
  let montoTransfer = null;
  if (metodo_pago === 'efectivo') {
    montoEfectivo = total;
  } else if (metodo_pago === 'transferencia') {
    montoTransfer = total;
  } else if (metodo_pago === 'mixto') {
    montoEfectivo = Number(monto_efectivo) || 0;
    montoTransfer = Number(monto_transferencia) || 0;
  }

  return prisma.venta.create({
    data: {
      id_cliente, id_estado: estadoPendiente?.id_estado || 1,
      id_direccion: direccionId, costo_domicilio, observaciones,
      metodo_pago:         metodo_pago   || null,
      monto_efectivo:      montoEfectivo,
      monto_transferencia: montoTransfer,
      comprobante_url: comprobante_url || null,
      subtotal, total,
      detalleVentas: {
        create: itemsCalc.map((item) => ({
          id_producto: item.id_producto, cantidad: item.cantidad,
          precio_unitario: item.precio_unitario, subtotal: item.subtotal,
          chocolate: item.chocolate || null,
          detalleToppings:  { create: (item.toppings || []).map((t) => typeof t === 'number' ? { id_topping: t, cantidad: 1 } : { id_topping: t.id_topping, cantidad: t.cantidad || 1 }) },
          detalleAdiciones: { create: item.adicionesCalc.map((a) => ({
            id_adicion: a.id_adicion, cantidad: a.cantidad,
            precio_unitario: a.precio_unitario, subtotal: a.subtotal,
          })) },
        })),
      },
    },
    include: includeDetalle,
  });
};

const cambiarEstado = async (id, datos, id_usuario) => {
  const { id_estado, nombre_estado, metodo_pago, monto_efectivo, monto_transferencia, comprobante_url } = datos;
  await obtener(id);
  let estadoId    = id_estado;
  let estadoNombre = nombre_estado || null;
  if (!estadoId && nombre_estado) {
    const estado = await prisma.estado.findFirst({ where: { nombre_estado } });
    if (!estado) throw { status: 400, message: `Estado '${nombre_estado}' no existe` };
    estadoId     = estado.id_estado;
    estadoNombre = estado.nombre_estado;
  }
  // Validar motivo cuando se anula vía cambiarEstado
  if (estadoNombre === 'anulado') {
    const motivo = datos.motivo_anulacion || '';
    if (!String(motivo).trim()) throw { status: 400, message: 'El motivo de anulación es requerido' };
  }

  const updateData = { id_estado: estadoId };
  if (metodo_pago)                              updateData.metodo_pago         = metodo_pago;
  if (comprobante_url)                          updateData.comprobante_url     = comprobante_url;
  if (monto_efectivo      != null)              updateData.monto_efectivo      = Number(monto_efectivo);
  if (monto_transferencia != null)              updateData.monto_transferencia = Number(monto_transferencia);
  if (estadoNombre === 'anulado' && datos.motivo_anulacion) updateData.motivo_anulacion = String(datos.motivo_anulacion).trim();
  const ventaActualizada = await prisma.venta.update({
    where: { id_venta: id }, data: updateData, include: includeDetalle,
  });

  // Al coger (despachado) o entregar → guardar el domiciliario en la venta
  if ((estadoNombre === 'despachado' || estadoNombre === 'entregado') && id_usuario) {
    try {
      const empleado = await prisma.empleado.findUnique({ where: { id_usuario: Number(id_usuario) } });
      if (empleado) {
        await prisma.venta.update({
          where: { id_venta: id },
          data: { id_domiciliario: empleado.id_empleado },
        });
      }
    } catch (e) {
      console.error('Error guardando id_domiciliario:', e.message);
    }
  }

  // Al marcar como entregado con método de pago → crear detalle en pagos/detalle_pagos
  if (estadoNombre === 'entregado' && metodo_pago) {
    try {
      const empleado = id_usuario
        ? await prisma.empleado.findUnique({ where: { id_usuario: Number(id_usuario) } })
        : null;
      if (empleado) {
        const venta = await prisma.venta.findUnique({ where: { id_venta: id } });

        // Crear o actualizar registro de pago
        let pago = await prisma.pago.findFirst({ where: { id_venta: id } });
        if (pago) {
          pago = await prisma.pago.update({
            where: { id_pago: pago.id_pago },
            data: { total_pagado: venta.total, fecha_pago: new Date(), id_empleado: empleado.id_empleado },
          });
        } else {
          pago = await prisma.pago.create({
            data: { id_venta: id, id_empleado: empleado.id_empleado, total_pagado: venta.total, fecha_pago: new Date() },
          });
        }

        // Limpiar detalles anteriores y recrear
        await prisma.detallePago.deleteMany({ where: { id_pago: pago.id_pago } });

        const metodos     = await prisma.metodoPago.findMany();
        const mEfectivo   = metodos.find((m) => m.nombre.toLowerCase().includes('efectivo'));
        const mTransf     = metodos.find((m) => m.nombre.toLowerCase().includes('transferencia'));

        if (metodo_pago === 'efectivo' && mEfectivo) {
          await prisma.detallePago.create({
            data: { id_pago: pago.id_pago, id_metodo_pago: mEfectivo.id_metodo_pago, monto: venta.total },
          });
        } else if (metodo_pago === 'transferencia' && mTransf) {
          await prisma.detallePago.create({
            data: { id_pago: pago.id_pago, id_metodo_pago: mTransf.id_metodo_pago, monto: venta.total, comprobante: comprobante_url || null },
          });
        } else if (metodo_pago === 'mixto') {
          if (mEfectivo && Number(monto_efectivo) > 0) {
            await prisma.detallePago.create({
              data: { id_pago: pago.id_pago, id_metodo_pago: mEfectivo.id_metodo_pago, monto: Number(monto_efectivo) },
            });
          }
          if (mTransf && Number(monto_transferencia) > 0) {
            await prisma.detallePago.create({
              data: { id_pago: pago.id_pago, id_metodo_pago: mTransf.id_metodo_pago, monto: Number(monto_transferencia), comprobante: comprobante_url || null },
            });
          }
        }
      }
    } catch (pagoErr) {
      console.error('Error creando pago detallado:', pagoErr.message);
    }
    // Re-fetch para incluir los pagos recién creados en la respuesta
    return obtener(id);
  }

  return ventaActualizada;
};

const anular = async (id, motivo_anulacion) => {
  if (!motivo_anulacion || !String(motivo_anulacion).trim()) {
    throw { status: 400, message: 'El motivo de anulación es requerido' };
  }
  const venta = await obtener(id);
  if (venta.estado?.nombre_estado === 'anulado') throw { status: 400, message: 'La venta ya está anulada' };
  const estadoAnulado = await prisma.estado.findFirst({ where: { nombre_estado: 'anulado' } });
  return prisma.venta.update({
    where: { id_venta: id },
    data: { motivo_anulacion, id_estado: estadoAnulado?.id_estado },
    include: includeDetalle,
  });
};

const comprobante = async (id) => {
  const venta = await obtener(id);
  return {
    comprobante: {
      numero:        `VTA-${String(venta.id_venta).padStart(6, '0')}`,
      fecha:         venta.fecha,
      cliente:       venta.cliente?.usuario?.nombre,
      estado:        venta.estado?.nombre_estado,
      items:         venta.detalleVentas.map((d) => ({
        producto:   d.producto.nombre,
        cantidad:   d.cantidad,
        precio:     d.precio_unitario,
        subtotal:   d.subtotal,
        toppings:   d.detalleToppings.map((t) => t.topping.nombre),
        adiciones:  d.detalleAdiciones.map((a) => ({ nombre: a.adicion.nombre, cantidad: a.cantidad })),
      })),
      subtotal:      venta.subtotal,
      costo_domicilio: venta.costo_domicilio,
      total:         venta.total,
    },
  };
};

const whatsapp = async (id) => {
  const venta = await obtener(id);
  const num   = `VTA-${String(venta.id_venta).padStart(6, '0')}`;
  const msg   = encodeURIComponent(
    `*Comprobante ${num}*\n` +
    `Cliente: ${venta.cliente?.usuario?.nombre}\n` +
    `Total: $${Number(venta.total).toLocaleString('es-CO')}\n` +
    `Estado: ${venta.estado?.nombre_estado}\n` +
    `Fecha: ${new Date(venta.fecha).toLocaleString('es-CO')}`
  );
  return { url: `https://wa.me/?text=${msg}`, comprobante_numero: num };
};

const totalVenta = async (id) => {
  const v = await obtener(id);
  return { id_venta: id, subtotal: v.subtotal, costo_domicilio: v.costo_domicilio, total: v.total };
};

// Ventas del cliente autenticado
const misVentas = async (id_usuario) => {
  const cliente = await prisma.cliente.findUnique({ where: { id_usuario } });
  if (!cliente) return [];
  return prisma.venta.findMany({
    where: { id_cliente: cliente.id_cliente },
    include: includeDetalle,
    orderBy: { fecha: 'desc' },
  });
};

// Cliente crea su propio pedido (auto-crea perfil de cliente si no existe)
const crearMiPedido = async (id_usuario, { id_direccion, nueva_direccion, costo_domicilio = 3000, observaciones, items, metodo_pago, monto_efectivo, monto_transferencia, comprobante_url }) => {
  let cliente = await prisma.cliente.findUnique({ where: { id_usuario } });
  if (!cliente) {
    // Auto-crear perfil de cliente para cualquier usuario autenticado
    cliente = await prisma.cliente.create({ data: { id_usuario } });
  }

  let direccionId = id_direccion;
  if (!direccionId && nueva_direccion) {
    const dir = await prisma.direccion.create({
      data: {
        id_cliente:      cliente.id_cliente,
        direccion_linea: nueva_direccion.direccion_linea,
        barrio:          nueva_direccion.barrio       || null,
        ciudad:          nueva_direccion.ciudad       || null,
        departamento:    nueva_direccion.departamento || null,
        referencia:      nueva_direccion.referencia   || null,
        lat:             nueva_direccion.lat          || null,
        lng:             nueva_direccion.lng          || null,
      },
    });
    direccionId = dir.id_direccion;
  }

  return crear({ id_cliente: cliente.id_cliente, id_direccion: direccionId, costo_domicilio, observaciones, items, metodo_pago, monto_efectivo, monto_transferencia, comprobante_url });
};

const editar = async (id, { items, costo_domicilio, metodo_pago, monto_efectivo, monto_transferencia }) => {
  const venta = await obtener(id);
  const estadoActual = venta.estado?.nombre_estado;

  // Anuladas: nunca se pueden tocar
  if (estadoActual === 'anulado') {
    throw { status: 400, message: 'No se puede editar una venta anulada' };
  }

  // Entregadas: solo se permite cambiar el método de pago (no los productos)
  if (estadoActual === 'entregado') {
    if (!metodo_pago) throw { status: 400, message: 'En ventas entregadas solo se puede cambiar el método de pago' };

    let montoEf = null, montoTr = null, metodoFinal = metodo_pago;
    if (metodo_pago === 'efectivo')      { montoEf = Number(venta.total); montoTr = 0; }
    if (metodo_pago === 'transferencia') { montoTr = Number(venta.total); montoEf = 0; }
    if (metodo_pago === 'mixto')         { montoEf = Number(monto_efectivo || 0); montoTr = Number(monto_transferencia || 0); }

    await prisma.venta.update({
      where: { id_venta: id },
      data: { metodo_pago: metodoFinal, monto_efectivo: montoEf, monto_transferencia: montoTr },
    });
    return obtener(id);
  }

  // Borrar detalles existentes en orden de FK
  const detalleIds = venta.detalleVentas.map((d) => d.id_detalle_venta);
  if (detalleIds.length > 0) {
    await prisma.detalleTopping.deleteMany({ where: { id_detalle_venta: { in: detalleIds } } });
    await prisma.detalleAdicion.deleteMany({ where: { id_detalle_venta: { in: detalleIds } } });
    await prisma.detalleVenta.deleteMany({ where: { id_venta: id } });
  }

  // Recalcular con misma lógica que crear
  const productoIds = items.map((i) => i.id_producto);
  const productos   = await prisma.producto.findMany({ where: { id_producto: { in: productoIds } } });
  const prodData    = Object.fromEntries(productos.map((p) => [p.id_producto, { precio: Number(p.precio), max_toppings: p.max_toppings || 0 }]));

  const adicionIds  = items.flatMap((i) => (i.adiciones || []).map((a) => a.id_adicion));
  const adics       = adicionIds.length ? await prisma.adicion.findMany({ where: { id_adicion: { in: adicionIds } } }) : [];
  const precioA     = Object.fromEntries(adics.map((a) => [a.id_adicion, Number(a.precio)]));

  let subtotal = 0;
  const itemsCalc = items.map((item) => {
    const pd = prodData[item.id_producto];
    if (!pd) throw { status: 400, message: `Producto ${item.id_producto} no encontrado` };
    const maxTop = item.max_toppings != null ? item.max_toppings : pd.max_toppings;
    const totalTop = (item.toppings || []).reduce((s, t) => s + (typeof t === 'number' ? 1 : (t.cantidad || 1)), 0);
    const toppingExtra = Math.max(0, totalTop - maxTop) * 2000;
    const precioUnitItem = pd.precio + toppingExtra;
    const adicionesCalc = (item.adiciones || []).map((a) => ({
      id_adicion: a.id_adicion, cantidad: a.cantidad,
      precio_unitario: precioA[a.id_adicion] || 0,
      subtotal: (precioA[a.id_adicion] || 0) * a.cantidad,
    }));
    const itemSub = precioUnitItem * item.cantidad + adicionesCalc.reduce((s, a) => s + a.subtotal, 0);
    subtotal += itemSub;
    return { ...item, precio_unitario: precioUnitItem, subtotal: precioUnitItem * item.cantidad, adicionesCalc };
  });

  const total = subtotal + Number(costo_domicilio || 0);

  // Calcular montos si se especifica método de pago
  let montoEf = venta.monto_efectivo;
  let montoTr = venta.monto_transferencia;
  let metodoFinal = venta.metodo_pago;
  if (metodo_pago) {
    metodoFinal = metodo_pago;
    montoEf = monto_efectivo !== undefined ? Number(monto_efectivo) : montoEf;
    montoTr = monto_transferencia !== undefined ? Number(monto_transferencia) : montoTr;
  }

  await prisma.venta.update({
    where: { id_venta: id },
    data: {
      subtotal, total, costo_domicilio: Number(costo_domicilio || 0),
      metodo_pago: metodoFinal,
      monto_efectivo: montoEf,
      monto_transferencia: montoTr,
      detalleVentas: {
        create: itemsCalc.map((item) => ({
          id_producto: item.id_producto, cantidad: item.cantidad,
          precio_unitario: item.precio_unitario, subtotal: item.subtotal,
          chocolate: item.chocolate || null,
          detalleToppings:  { create: (item.toppings || []).map((t) => typeof t === 'number' ? { id_topping: t, cantidad: 1 } : { id_topping: t.id_topping, cantidad: t.cantidad || 1 }) },
          detalleAdiciones: { create: item.adicionesCalc.map((a) => ({ id_adicion: a.id_adicion, cantidad: a.cantidad, precio_unitario: a.precio_unitario, subtotal: a.subtotal })) },
        })),
      },
    },
  });

  return obtener(id);
};

module.exports = { listar, filtrar, obtener, crear, cambiarEstado, anular, comprobante, whatsapp, totalVenta, misVentas, crearMiPedido, editar };
