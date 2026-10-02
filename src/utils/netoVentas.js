// Ventas netas de un conjunto de ventas ENTREGADAS -- única fuente de verdad
// para métricas (ventas netas, desglose por método, promedio mensual) y las
// gráficas del dashboard (por día / semana / mes), para que todas cuadren.
//
// Regla de negocio (2026-09-22): el costo de domicilio SIEMPRE se paga en
// efectivo al domiciliario, sin importar cómo pagó el cliente -- así que se
// resta UNA sola vez, en agregado, del bucket de efectivo. Transferencia y
// datáfono van por su monto bruto (nunca se les resta domicilio). Mismo
// criterio que dashboard/service.js totalDia() y cierreCaja resumenDia().
//
//   neto = (efectivo bruto − domicilios) + transferencia + datáfono
//
// Cada venta necesita: metodo_pago, total, costo_domicilio, monto_efectivo,
// monto_transferencia.
const netoVentas = (ventas) => {
  let efectivoBruto = 0;
  let transferencia = 0;
  let datafono      = 0;
  let domicilios    = 0;

  ventas.forEach((v) => {
    domicilios += Number(v.costo_domicilio || 0);
    switch (v.metodo_pago) {
      case 'mixto':
        efectivoBruto += Number(v.monto_efectivo || 0);
        transferencia += Number(v.monto_transferencia || 0);
        break;
      case 'efectivo':      efectivoBruto += Number(v.total); break;
      case 'transferencia': transferencia += Number(v.total); break;
      case 'datafono':      datafono      += Number(v.total); break;
      default: break;
    }
  });

  const efectivo = efectivoBruto - domicilios;
  return { efectivo, efectivoBruto, transferencia, datafono, domicilios, neto: efectivo + transferencia + datafono };
};

// Mes (1-12) y año de una fecha en hora Colombia (UTC-5, sin horario de
// verano) -- la columna `ventas.fecha` es timestamp sin zona guardado en UTC,
// así que una venta del 30 a las 7pm Colombia ya es día 1 en UTC.
const mesAnioColombia = (fecha) => {
  const co = new Date(new Date(fecha).getTime() - 5 * 60 * 60 * 1000);
  return { mes: co.getUTCMonth() + 1, anio: co.getUTCFullYear() };
};

module.exports = { netoVentas, mesAnioColombia };
