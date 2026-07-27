require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function crearVentasPrueba() {
  // Obtener datos reales de BD
  const cliente = await prisma.cliente.findFirst({
    where: { usuario: { estado: 1 } }
  });
  const direccion = await prisma.direccion.findFirst({
    where: { id_cliente: cliente.id_cliente }
  });
  const productos = await prisma.producto.findMany({
    where: { estado: 1 },
    include: { categoria: true }
  });
  const toppings = await prisma.topping.findMany({
    where: { estado: 1 }
  });
  const adiciones = await prisma.adicion.findMany({
    where: { estado: 1 }
  });
  const estadoEntregado = await prisma.estado.findFirst({
    where: { nombre_estado: 'entregado' }
  });

  // Mostrar datos disponibles
  console.log('Productos disponibles:\n  ' + productos.map(p =>
    p.nombre + '(bowl:' + p.es_bowl + ',choco:' +
    p.permite_chocolate + ',salsas:' + p.permite_salsas +
    ',toppings:' + p.permite_toppings + ')'
  ).join('\n  '));
  console.log('Toppings:', toppings.map(t => t.nombre).join(', '));
  console.log('Adiciones:', adiciones.map(a => a.nombre).join(', '));

  const ventas = [];

  // CASO 1: Efectivo, producto simple sin extras
  const prod1 = productos[0];
  const v1 = await prisma.venta.create({
    data: {
      id_cliente: cliente.id_cliente,
      id_estado: estadoEntregado.id_estado,
      id_direccion: direccion?.id_direccion,
      subtotal: Number(prod1.precio),
      costo_domicilio: 6000,
      total: Number(prod1.precio) + 6000,
      metodo_pago: 'efectivo',
      monto_efectivo: Number(prod1.precio) + 6000,
      monto_transferencia: 0,
      puntos_usados: 0,
      descuento_puntos: 0,
      observaciones: 'Prueba 1: efectivo simple',
      detalleVentas: {
        create: [{
          id_producto: prod1.id_producto,
          cantidad: 1,
          precio_unitario: Number(prod1.precio),
          subtotal: Number(prod1.precio)
        }]
      }
    }
  });
  ventas.push(v1.id_venta);
  console.log('V1 creada: efectivo simple #' + v1.id_venta);

  // CASO 2: Transferencia, con toppings extra
  const prod2 = productos.find(p => p.permite_toppings) || productos[1];
  const maxTop = prod2.max_toppings || 1;
  const toppingExtra = toppings.slice(0, maxTop + 1); // 1 extra
  const precioToppingExtra = 2000;
  const subtotal2 = Number(prod2.precio) + precioToppingExtra;
  const v2 = await prisma.venta.create({
    data: {
      id_cliente: cliente.id_cliente,
      id_estado: estadoEntregado.id_estado,
      id_direccion: direccion?.id_direccion,
      subtotal: subtotal2,
      costo_domicilio: 7000,
      total: subtotal2 + 7000,
      metodo_pago: 'transferencia',
      monto_efectivo: 0,
      monto_transferencia: subtotal2 + 7000,
      puntos_usados: 0,
      descuento_puntos: 0,
      observaciones: 'Prueba 2: transferencia con toppings',
      detalleVentas: {
        create: [{
          id_producto: prod2.id_producto,
          cantidad: 1,
          precio_unitario: subtotal2,
          subtotal: subtotal2,
          detalleToppings: toppingExtra.length > 0 ? {
            create: toppingExtra.map(t => ({
              id_topping: t.id_topping,
              cantidad: 1
            }))
          } : undefined
        }]
      }
    }
  });
  ventas.push(v2.id_venta);
  console.log('V2 creada: transferencia+toppings #' + v2.id_venta);

  // CASO 3: Mixto, con adiciones
  const prod3 = productos[2] || productos[0];
  const adicion1 = adiciones[0];
  const subtotal3 = Number(prod3.precio) +
    (adicion1 ? Number(adicion1.precio) : 0);
  const total3 = subtotal3 + 8000;
  const v3 = await prisma.venta.create({
    data: {
      id_cliente: cliente.id_cliente,
      id_estado: estadoEntregado.id_estado,
      id_direccion: direccion?.id_direccion,
      subtotal: subtotal3,
      costo_domicilio: 8000,
      total: total3,
      metodo_pago: 'mixto',
      monto_efectivo: Math.floor(total3 / 2),
      monto_transferencia: Math.ceil(total3 / 2),
      puntos_usados: 0,
      descuento_puntos: 0,
      observaciones: 'Prueba 3: mixto con adiciones',
      detalleVentas: {
        create: [{
          id_producto: prod3.id_producto,
          cantidad: 1,
          precio_unitario: subtotal3,
          subtotal: subtotal3,
          detalleAdiciones: adicion1 ? {
            create: [{
              id_adicion: adicion1.id_adicion,
              cantidad: 1,
              precio_unitario: Number(adicion1.precio),
              subtotal: Number(adicion1.precio)
            }]
          } : undefined
        }]
      }
    }
  });
  ventas.push(v3.id_venta);
  console.log('V3 creada: mixto+adiciones #' + v3.id_venta);

  // CASO 4: Efectivo, Bowl con cobertura
  const bowl = productos.find(p => p.es_bowl) || productos[0];
  const subtotal4 = Number(bowl.precio);
  const v4 = await prisma.venta.create({
    data: {
      id_cliente: cliente.id_cliente,
      id_estado: estadoEntregado.id_estado,
      id_direccion: direccion?.id_direccion,
      subtotal: subtotal4,
      costo_domicilio: 6000,
      total: subtotal4 + 6000,
      metodo_pago: 'efectivo',
      monto_efectivo: subtotal4 + 6000,
      monto_transferencia: 0,
      puntos_usados: 0,
      descuento_puntos: 0,
      observaciones: 'Prueba 4: bowl con arequipe',
      detalleVentas: {
        create: [{
          id_producto: bowl.id_producto,
          cantidad: 1,
          precio_unitario: subtotal4,
          subtotal: subtotal4,
          salsas: JSON.stringify([{ nombre: 'Arequipe' }])
        }]
      }
    }
  });
  ventas.push(v4.id_venta);
  console.log('V4 creada: bowl arequipe #' + v4.id_venta);

  // CASO 5: Transferencia con puntos usados
  const prod5 = productos[1] || productos[0];
  const puntosUsados = 8;
  const descuento = puntosUsados * 12.5;
  const subtotal5 = Number(prod5.precio);
  const total5 = subtotal5 - descuento + 6000;
  const v5 = await prisma.venta.create({
    data: {
      id_cliente: cliente.id_cliente,
      id_estado: estadoEntregado.id_estado,
      id_direccion: direccion?.id_direccion,
      subtotal: subtotal5,
      costo_domicilio: 6000,
      total: total5,
      metodo_pago: 'transferencia',
      monto_efectivo: 0,
      monto_transferencia: total5,
      puntos_usados: puntosUsados,
      descuento_puntos: descuento,
      observaciones: 'Prueba 5: con descuento puntos',
      detalleVentas: {
        create: [{
          id_producto: prod5.id_producto,
          cantidad: 1,
          precio_unitario: subtotal5,
          subtotal: subtotal5
        }]
      }
    }
  });
  ventas.push(v5.id_venta);
  console.log('V5 creada: transferencia+puntos #' + v5.id_venta);

  // CASOS 6-10: Variaciones adicionales
  for (let i = 6; i <= 10; i++) {
    const prod = productos[i % productos.length];
    const metodo = ['efectivo', 'transferencia', 'mixto'][i % 3];
    const subtotal = Number(prod.precio);
    const domi = [6000, 7000, 8000, 9000][i % 4];
    const total = subtotal + domi;
    const v = await prisma.venta.create({
      data: {
        id_cliente: cliente.id_cliente,
        id_estado: estadoEntregado.id_estado,
        id_direccion: direccion?.id_direccion,
        subtotal,
        costo_domicilio: domi,
        total,
        metodo_pago: metodo,
        monto_efectivo: metodo === 'efectivo' ? total :
          metodo === 'mixto' ? Math.floor(total / 2) : 0,
        monto_transferencia: metodo === 'transferencia' ? total :
          metodo === 'mixto' ? Math.ceil(total / 2) : 0,
        puntos_usados: 0,
        descuento_puntos: 0,
        observaciones: 'Prueba ' + i + ': ' + metodo,
        detalleVentas: {
          create: [{
            id_producto: prod.id_producto,
            cantidad: 1,
            precio_unitario: subtotal,
            subtotal: subtotal
          }]
        }
      }
    });
    ventas.push(v.id_venta);
    console.log('V' + i + ' creada: ' + metodo + ' #' + v.id_venta);
  }

  // RESUMEN ESPERADO
  const todasVentas = await prisma.venta.findMany({
    where: { id_venta: { in: ventas } }
  });

  let efectivo = 0, transferencia = 0, domicilios = 0;
  for (const v of todasVentas) {
    efectivo += Number(v.monto_efectivo || 0);
    transferencia += Number(v.monto_transferencia || 0);
    domicilios += Number(v.costo_domicilio || 0);
  }

  console.log('\n=== RESUMEN ESPERADO EN DASHBOARD Y CIERRE ===');
  console.log('Total ventas:', '$' + (efectivo + transferencia).toLocaleString('es-CO'));
  console.log('Efectivo total:', '$' + efectivo.toLocaleString('es-CO'));
  console.log('Transferencias:', '$' + transferencia.toLocaleString('es-CO'));
  console.log('Total domicilios:', '$' + domicilios.toLocaleString('es-CO'));
  console.log('Efectivo sin domicilios:', '$' + (efectivo - domicilios).toLocaleString('es-CO'));
  console.log('\nIDs creadas:', ventas.join(', '));
  console.log('\nEstos valores deben aparecer EXACTOS en el dashboard.');
  console.log('Para borrar: node borrar_prueba.js ' + ventas.join(' '));
}

crearVentasPrueba().catch(console.error).finally(() => prisma.$disconnect());
