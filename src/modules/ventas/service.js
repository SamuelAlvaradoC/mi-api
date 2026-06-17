const prisma = require('../../config/prisma');
const { acumularPuntos, calcularDescuentoPuntos, obtenerPuntos } = require('../puntos/service');
const { getIo } = require('../../socket');

const includeDetalle = {
  cliente:  { select: { id_cliente: true, telefono: true, ciudad: true, barrio: true, usuario: { select: { nombre: true, email: true } } } },
  estado:   true,
  direccion: true,
  pagos:    { include: { detallePagos: { include: { metodoPago: true } } } },
  movimientosPuntos: true,
  detalleVentas: {
    include: {
      producto: { select: { id_producto: true, nombre: true, precio: true, max_toppings: true, permite_toppings: true, img: true } },
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
  if (!v.id_domiciliario) return { ...v, nombreDomiciliario: null };
  const empleado = await prisma.empleado.findUnique({
    where: { id_empleado: v.id_domiciliario },
    include: { usuario: { select: { nombre: true } } },
  });
  return { ...v, nombreDomiciliario: empleado?.usuario?.nombre || null };
};

const crear = async ({ id_cliente, id_direccion, nueva_direccion, costo_domicilio = 0, observaciones, items, metodo_pago, monto_efectivo, monto_transferencia, comprobante_url, puntos_usados = 0, descuento_puntos = 0 }) => {
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
  const productos   = await prisma.producto.findMany({ where: { id_producto: { in: productoIds }, estado: 1 } });
  // Guardar permite_toppings para calcular correctamente cuántos son gratis
  const prodData    = Object.fromEntries(productos.map((p) => [p.id_producto, {
    precio: Number(p.precio), max_toppings: p.max_toppings || 0, permite_toppings: p.permite_toppings || 0
  }]));

  const adicionIds  = items.flatMap((i) => (i.adiciones || []).map((a) => a.id_adicion));
  const adiciones   = adicionIds.length ? await prisma.adicion.findMany({ where: { id_adicion: { in: adicionIds } } }) : [];
  const precioA     = Object.fromEntries(adiciones.map((a) => [a.id_adicion, Number(a.precio)]));

  let subtotal = 0;
  const itemsCalc = items.map((item) => {
    const pd = prodData[item.id_producto];
    if (!pd) throw { status: 400, message: `Producto ${item.id_producto} no disponible` };
    // Si permite_toppings=0: ningún topping es gratis (todos se cobran a $2000)
    // max_toppings SIEMPRE viene de la BD (pd), nunca del cliente — evita manipulación de precio
    const maxTop = pd.permite_toppings ? pd.max_toppings : 0;
    const totalTop = (item.toppings || []).reduce((s, t) => s + (typeof t === 'number' ? 1 : (t.cantidad || 1)), 0);
    const toppingExtra = Math.max(0, totalTop - maxTop) * 2000;
    const precioUnitItem = pd.precio + toppingExtra;
    const adicionesCalc = (item.adiciones || []).map((a) => ({
      id_adicion: a.id_adicion, cantidad: a.cantidad,
      precio_unitario: precioA[a.id_adicion],
      subtotal: precioA[a.id_adicion] * a.cantidad,
    }));
    const adicionPerUnit = adicionesCalc.reduce((s, a) => s + a.subtotal, 0);
    // Salsas extra: las primeras 2 son gratis, el resto $5.000 c/u
    const salsasArr      = Array.isArray(item.salsas) ? item.salsas : [];
    const salsasExtra    = Math.max(0, salsasArr.length - 2);
    const salsaExtraUnit = salsasExtra * 5000;
    // precio_unitario incluye: base + toppings extra + salsas extra (adiciones se guardan separado)
    const precioUnitFinal = precioUnitItem + salsaExtraUnit;
    const itemSub = (precioUnitFinal + adicionPerUnit) * item.cantidad;
    subtotal += itemSub;
    return { ...item, precio_unitario: precioUnitFinal, subtotal: precioUnitFinal * item.cantidad, adicionesCalc };
  });

  const estadoPendiente = await prisma.estado.findFirst({ where: { nombre_estado: 'pendiente' } });
  // Auto-calcular descuento_puntos desde puntos_usados si no se envió explícitamente
  const descuentoCalc   = Number(descuento_puntos) || (Number(puntos_usados) > 0 ? calcularDescuentoPuntos(Number(puntos_usados)) : 0);
  // Descuento de puntos solo aplica al subtotal de productos (nunca al domicilio)
  const descuento       = Math.min(descuentoCalc, subtotal);
  const total           = Math.max(0, subtotal - descuento) + Number(costo_domicilio);

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

  const nuevaVenta = await prisma.venta.create({
    data: {
      id_cliente, id_estado: estadoPendiente?.id_estado || 1,
      id_direccion: direccionId, costo_domicilio, observaciones,
      metodo_pago:         metodo_pago   || null,
      monto_efectivo:      montoEfectivo,
      monto_transferencia: montoTransfer,
      comprobante_url: comprobante_url || null,
      subtotal, total,
      puntos_usados:   Number(puntos_usados) || 0,
      descuento_puntos: descuento,
      detalleVentas: {
        create: itemsCalc.map((item) => ({
          id_producto: item.id_producto, cantidad: item.cantidad,
          precio_unitario: item.precio_unitario, subtotal: item.subtotal,
          chocolate: item.chocolate || null,
          salsas: item.salsas?.length ? JSON.stringify(item.salsas) : null,
          detalleToppings:  { create: (item.toppings || []).map((t) => typeof t === 'number' ? { id_topping: t, cantidad: 1 } : { id_topping: t.id_topping, cantidad: t.cantidad || 1 }) },
          detalleAdiciones: { create: item.adicionesCalc.map((a) => ({
            id_adicion: a.id_adicion, cantidad: a.cantidad,
            precio_unitario: a.precio_unitario, subtotal: a.subtotal * item.cantidad,
          })) },
        })),
      },
    },
    include: includeDetalle,
  });

  if (Number(puntos_usados) > 0) {
    try {
      const regPts = await prisma.puntosCliente.findUnique({ where: { id_cliente } });
      if (regPts) {
        await prisma.puntosCliente.update({
          where: { id_cliente },
          data:  { puntos: { decrement: Number(puntos_usados) } },
        });
        await prisma.movimientoPuntos.create({
          data: {
            id_puntos:   regPts.id_puntos,
            id_venta:    nuevaVenta.id_venta,
            tipo:        'uso',
            puntos:      -Number(puntos_usados),
            descripcion: `Puntos usados en pedido #${nuevaVenta.id_venta}`,
          },
        });
      }
    } catch (e) { console.error('Error descontando puntos:', e.message); }
  }

  return nuevaVenta;
};

const cambiarEstado = async (id, datos, id_usuario) => {
  const { id_estado, nombre_estado, metodo_pago, monto_efectivo, monto_transferencia, comprobante_url } = datos;
  const ventaActual = await obtener(id);
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

  // Devolver puntos si se anula y la venta usó puntos
  if (estadoNombre === 'anulado' && Number(ventaActual.puntos_usados) > 0 && ventaActual.estado?.nombre_estado !== 'anulado') {
    try {
      const regPts = await prisma.puntosCliente.findUnique({ where: { id_cliente: ventaActual.id_cliente } });
      if (regPts) {
        await prisma.puntosCliente.update({
          where: { id_cliente: ventaActual.id_cliente },
          data:  { puntos: { increment: Number(ventaActual.puntos_usados) } },
        });
        await prisma.movimientoPuntos.create({
          data: {
            id_puntos:   regPts.id_puntos,
            id_venta:    id,
            tipo:        'devolucion',
            puntos:      Number(ventaActual.puntos_usados),
            descripcion: `Devolución por anulación del pedido #${id}`,
          },
        });
      }
    } catch (e) { console.error('Error devolviendo puntos al anular:', e.message); }
  }

  if (estadoNombre === 'anulado' && ventaActual.estado?.nombre_estado === 'entregado') {
    try {
      const movAcumulacion = await prisma.movimientoPuntos.findFirst({
        where: { id_venta: id, tipo: 'acumulacion' },
      });
      if (movAcumulacion) {
        const regPtsAcum = await prisma.puntosCliente.findUnique({ where: { id_cliente: ventaActual.id_cliente } });
        if (regPtsAcum) {
          await prisma.puntosCliente.update({
            where: { id_cliente: ventaActual.id_cliente },
            data: { puntos: { decrement: movAcumulacion.puntos } },
          });
          await prisma.movimientoPuntos.create({
            data: {
              id_puntos: regPtsAcum.id_puntos,
              id_venta: id,
              tipo: 'devolucion',
              puntos: -movAcumulacion.puntos,
              descripcion: `Reversión por anulación de pedido #${id} (estaba entregado)`,
            },
          });
        }
      }
    } catch (e) { console.error('Error revirtiendo puntos acumulados al anular:', e.message); }
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
  // Solo si quien actúa es un Domiciliario (nunca sobreescribir con id del admin)
  if ((estadoNombre === 'despachado' || estadoNombre === 'entregado') && id_usuario) {
    try {
      const empleado = await prisma.empleado.findUnique({ where: { id_usuario: Number(id_usuario) } });
      const esDomiciliario = empleado?.cargo?.toLowerCase().includes('domiciliario');
      if (empleado && esDomiciliario) {
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

  // Acumular puntos al marcar como entregado (en cualquier caso, con o sin método de pago)
  if (estadoNombre === 'entregado') {
    try {
      const yaAcumulo = await prisma.movimientoPuntos.findFirst({
        where: { id_venta: id, tipo: 'acumulacion' },
      });
      if (yaAcumulo) {
        console.log('Puntos ya acumulados para venta #' + id + ' — omitiendo');
      } else {
        const ventaCompleta = await prisma.venta.findUnique({
          where: { id_venta: id },
          select: { subtotal: true, puntos_usados: true, id_cliente: true },
        });
        if (ventaCompleta?.id_cliente) {
          await acumularPuntos(
            ventaCompleta.id_cliente,
            id,
            Number(ventaCompleta.subtotal),
            ventaCompleta.puntos_usados || 0
          );
        }
      }
    } catch (e) {
      console.error('Error acumulando puntos:', e.message);
    }
  }

  // Notificar al impresor cuando pasa a 'listo'
  if (estadoNombre === 'listo') {
    try {
      const io = getIo();
      if (io) {
        const ventaParaImprimir = await obtener(id);
        const puntos_usados_val = ventaParaImprimir.puntos_usados || 0;
        const puntos_ganados_val = puntos_usados_val > 0
          ? 0
          : Math.floor(Number(ventaParaImprimir.subtotal || 0) / 500);
        let puntos_actuales_val = 0;
        try {
          if (ventaParaImprimir.id_cliente) {
            const reg = await obtenerPuntos(ventaParaImprimir.id_cliente);
            puntos_actuales_val = reg.puntos || 0;
          }
        } catch (_) {}
        io.emit('pedido_listo', {
          id_venta:       ventaParaImprimir.id_venta,
          cliente:        ventaParaImprimir.cliente?.usuario?.nombre || '—',
          telefono:       ventaParaImprimir.cliente?.telefono || '—',
          direccion:      ventaParaImprimir.direccion?.direccion_linea || '—',
          barrio:         ventaParaImprimir.direccion?.barrio || '',
          ciudad:         ventaParaImprimir.direccion?.ciudad || '',
          referencia:     ventaParaImprimir.direccion?.referencia || '',
          total:          ventaParaImprimir.total,
          subtotal:       ventaParaImprimir.subtotal,
          costo_domicilio: ventaParaImprimir.costo_domicilio,
          metodo_pago:    ventaParaImprimir.metodo_pago,
          monto_efectivo: ventaParaImprimir.monto_efectivo,
          monto_transferencia: ventaParaImprimir.monto_transferencia,
          observaciones:  ventaParaImprimir.observaciones,
          puntos_usados:    puntos_usados_val,
          descuento_puntos: ventaParaImprimir.descuento_puntos || 0,
          puntos_ganados:   puntos_ganados_val,
          puntos_actuales:  puntos_actuales_val,
          puntosTotal:      puntos_actuales_val + puntos_ganados_val,
          detalleVentas:  ventaParaImprimir.detalleVentas,
          fecha:          ventaParaImprimir.fecha,
        });
      }
    } catch(e) { console.error('Error emitiendo pedido_listo:', e.message); }
  }

  return ventaActualizada;
};

const anular = async (id, motivo_anulacion) => {
  if (!motivo_anulacion || !String(motivo_anulacion).trim()) {
    throw { status: 400, message: 'El motivo de anulación es requerido' };
  }
  const venta = await obtener(id);
  if (venta.estado?.nombre_estado === 'anulado') throw { status: 400, message: 'La venta ya está anulada' };

  if (Number(venta.puntos_usados) > 0) {
    try {
      const regPts = await prisma.puntosCliente.findUnique({ where: { id_cliente: venta.id_cliente } });
      if (regPts) {
        await prisma.puntosCliente.update({
          where: { id_cliente: venta.id_cliente },
          data:  { puntos: { increment: Number(venta.puntos_usados) } },
        });
        await prisma.movimientoPuntos.create({
          data: {
            id_puntos:   regPts.id_puntos,
            id_venta:    id,
            tipo:        'devolucion',
            puntos:      Number(venta.puntos_usados),
            descripcion: `Devolución por anulación del pedido #${id}`,
          },
        });
        console.log('Puntos devueltos:', venta.puntos_usados, 'cliente:', venta.id_cliente);
      }
    } catch (e) { console.error('Error devolviendo puntos:', e.message); }
  }

  if (venta.estado?.nombre_estado === 'entregado') {
    try {
      const movAcumulacion = await prisma.movimientoPuntos.findFirst({
        where: { id_venta: id, tipo: 'acumulacion' },
      });
      if (movAcumulacion) {
        const regPtsAcum = await prisma.puntosCliente.findUnique({ where: { id_cliente: venta.id_cliente } });
        if (regPtsAcum) {
          await prisma.puntosCliente.update({
            where: { id_cliente: venta.id_cliente },
            data: { puntos: { decrement: movAcumulacion.puntos } },
          });
          await prisma.movimientoPuntos.create({
            data: {
              id_puntos: regPtsAcum.id_puntos,
              id_venta: id,
              tipo: 'devolucion',
              puntos: -movAcumulacion.puntos,
              descripcion: `Reversión por anulación de pedido #${id} (estaba entregado)`,
            },
          });
        }
      }
    } catch (e) { console.error('Error revirtiendo puntos acumulados al anular:', e.message); }
  }

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
const crearMiPedido = async (id_usuario, { id_direccion, nueva_direccion, costo_domicilio = 3000, observaciones, items, metodo_pago, monto_efectivo, monto_transferencia, comprobante_url, puntos_a_usar = 0 }) => {
  let cliente = await prisma.cliente.findUnique({ where: { id_usuario } });
  if (!cliente) {
    cliente = await prisma.cliente.create({ data: { id_usuario } });
  }

  // Validar puntos si se quieren usar
  const puntosUsar = Number(puntos_a_usar) || 0;
  if (puntosUsar > 0) {
    const registro = await prisma.puntosCliente.findUnique({ where: { id_cliente: cliente.id_cliente } });
    if (!registro || registro.puntos < puntosUsar)
      throw { status: 400, message: 'No tienes suficientes puntos para aplicar este descuento' };
  }
  const descuento_puntos = puntosUsar > 0 ? calcularDescuentoPuntos(puntosUsar) : 0;

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

  return crear({ id_cliente: cliente.id_cliente, id_direccion: direccionId, costo_domicilio, observaciones, items, metodo_pago, monto_efectivo, monto_transferencia, comprobante_url, puntos_usados: puntosUsar, descuento_puntos });
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
  const prodData    = Object.fromEntries(productos.map((p) => [p.id_producto, {
    precio: Number(p.precio), max_toppings: p.max_toppings || 0, permite_toppings: p.permite_toppings || 0
  }]));

  const adicionIds  = items.flatMap((i) => (i.adiciones || []).map((a) => a.id_adicion));
  const adics       = adicionIds.length ? await prisma.adicion.findMany({ where: { id_adicion: { in: adicionIds } } }) : [];
  const precioA     = Object.fromEntries(adics.map((a) => [a.id_adicion, Number(a.precio)]));

  let subtotal = 0;
  const itemsCalc = items.map((item) => {
    const pd = prodData[item.id_producto];
    if (!pd) throw { status: 400, message: `Producto ${item.id_producto} no encontrado` };
    const maxTop = pd.permite_toppings ? pd.max_toppings : 0;
    const totalTop = (item.toppings || []).reduce((s, t) => s + (typeof t === 'number' ? 1 : (t.cantidad || 1)), 0);
    const toppingExtra = Math.max(0, totalTop - maxTop) * 2000;
    const precioUnitItem = pd.precio + toppingExtra;
    const adicionesCalc = (item.adiciones || []).map((a) => ({
      id_adicion: a.id_adicion, cantidad: a.cantidad,
      precio_unitario: precioA[a.id_adicion] || 0,
      subtotal: (precioA[a.id_adicion] || 0) * a.cantidad,
    }));
    const adicionPerUnit  = adicionesCalc.reduce((s, a) => s + a.subtotal, 0);
    const salsasArr2      = Array.isArray(item.salsas) ? item.salsas : [];
    const salsasCob2      = Math.max(0, salsasArr2.length - 2);
    const salsaExtra2     = salsasCob2 * 5000;
    const precioUnitFinal2 = precioUnitItem + salsaExtra2;
    const itemSub = (precioUnitFinal2 + adicionPerUnit) * item.cantidad;
    subtotal += itemSub;
    return { ...item, precio_unitario: precioUnitFinal2, subtotal: precioUnitFinal2 * item.cantidad, adicionesCalc };
  });

  const total = subtotal + Number(costo_domicilio || 0);

  // Calcular montos: para efectivo/transferencia siempre derivar del total real (evitar inconsistencias)
  let montoEf = venta.monto_efectivo;
  let montoTr = venta.monto_transferencia;
  let metodoFinal = venta.metodo_pago;
  if (metodo_pago) {
    metodoFinal = metodo_pago;
    if (metodo_pago === 'efectivo')      { montoEf = total; montoTr = 0; }
    else if (metodo_pago === 'transferencia') { montoTr = total; montoEf = 0; }
    else if (metodo_pago === 'mixto')    { montoEf = Number(monto_efectivo || 0); montoTr = Number(monto_transferencia || 0); }
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
          salsas: Array.isArray(item.salsas) && item.salsas.length > 0 ? JSON.stringify(item.salsas) : null,
          detalleToppings:  { create: (item.toppings || []).map((t) => typeof t === 'number' ? { id_topping: t, cantidad: 1 } : { id_topping: t.id_topping, cantidad: t.cantidad || 1 }) },
          detalleAdiciones: { create: item.adicionesCalc.map((a) => ({ id_adicion: a.id_adicion, cantidad: a.cantidad, precio_unitario: a.precio_unitario, subtotal: a.subtotal * item.cantidad })) },
        })),
      },
    },
  });

  return obtener(id);
};

module.exports = { listar, filtrar, obtener, crear, cambiarEstado, anular, comprobante, whatsapp, totalVenta, misVentas, crearMiPedido, editar };
