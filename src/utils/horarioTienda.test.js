// Horario de la tienda en hora Colombia (UTC-5). Horario de prueba: 1 a 8 PM.
const { estadoHorario } = require('./horarioTienda');

const H = { hora_apertura: 13, hora_cierre: 20, estado_tienda: 'schedule' };
// Hora Colombia -> instante UTC (sumando 5 horas). Lunes 19 de octubre de 2026.
const co = (dia, hora, min = 0) => new Date(Date.UTC(2026, 9, dia, hora + 5, min));

test('dentro del horario: abierta', () => {
  expect(estadoHorario(H, co(19, 15))).toMatchObject({ abierto: true, fueraDeHorario: false });
  expect(estadoHorario(H, co(19, 13, 0)).abierto).toBe(true);    // justo al abrir
  expect(estadoHorario(H, co(19, 19, 59)).abierto).toBe(true);   // un minuto antes de cerrar
});

test('antes de abrir: "hoy a la 1:00 PM" y la apertura es hoy a las 13:00 Colombia', () => {
  const e = estadoHorario(H, co(19, 9, 30));
  expect(e).toMatchObject({ abierto: false, fueraDeHorario: true, textoDia: 'hoy', textoHora: '1:00 PM' });
  expect(e.proximaApertura.toISOString()).toBe('2026-10-19T18:00:00.000Z'); // 13:00 Colombia
  // Un minuto antes de abrir también es "hoy"
  expect(estadoHorario(H, co(19, 12, 59)).textoDia).toBe('hoy');
});

test('después de cerrar: "mañana martes 20" a la 1:00 PM', () => {
  const e = estadoHorario(H, co(19, 22, 5)); // lunes 10:05 PM
  expect(e).toMatchObject({ fueraDeHorario: true, textoDia: 'mañana martes 20', textoHora: '1:00 PM' });
  expect(e.proximaApertura.toISOString()).toBe('2026-10-20T18:00:00.000Z');
  // Justo al cerrar (8:00 PM) ya es para mañana
  expect(estadoHorario(H, co(19, 20, 0)).textoDia).toBe('mañana martes 20');
});

test('después de medianoche (UTC ya es otro día): sigue siendo "hoy" en Colombia', () => {
  // Martes 1:00 AM Colombia = martes 06:00 UTC
  const e = estadoHorario(H, co(20, 1));
  expect(e.textoDia).toBe('hoy');
  expect(e.proximaApertura.toISOString()).toBe('2026-10-20T18:00:00.000Z');
});

test('fin de mes: el sábado 31 después de cerrar es "mañana domingo 1"', () => {
  expect(estadoHorario(H, co(31, 21)).textoDia).toBe('mañana domingo 1');
});

test('tienda "Cerrada" manual: cerrada, sin pedidos en espera', () => {
  expect(estadoHorario({ ...H, estado_tienda: 'closed' }, co(19, 15)))
    .toMatchObject({ abierto: false, cerradaManual: true, fueraDeHorario: false, proximaApertura: null });
});

test('tienda "Abierta" manual: abierta aunque sea de noche', () => {
  expect(estadoHorario({ ...H, estado_tienda: 'open' }, co(19, 23)).abierto).toBe(true);
});
