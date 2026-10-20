// POST /ventas/mi-pedido y el horario:
//  - "Cerrada" manual: bloqueado (403).
//  - "Por horario" fuera de horario sin aceptar el aviso: rechazado (409).
//  - con el aviso aceptado: pasa y deja la fecha de la próxima apertura.
jest.mock('../modules/configuracion/service', () => ({ horario: jest.fn() }));
const { horario } = require('../modules/configuracion/service');
const checkHorario = require('./checkHorario');

const H = { hora_apertura: 13, hora_cierre: 20, estado_tienda: 'schedule' };
const co = (dia, hora, min = 0) => new Date(Date.UTC(2026, 9, dia, hora + 5, min));

const llamar = async (body = {}) => {
  const req = { body };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
  const next = jest.fn();
  await checkHorario(req, res, next);
  return { req, res, next, cuerpo: res.json.mock.calls[0] && res.json.mock.calls[0][0] };
};

beforeEach(() => { jest.useFakeTimers(); horario.mockResolvedValue(H); });
afterEach(() => jest.useRealTimers());

test('dentro del horario: pasa como un pedido normal (sin fecha de apertura)', async () => {
  jest.setSystemTime(co(19, 15));
  const { next, req } = await llamar({});
  expect(next).toHaveBeenCalled();
  expect(req.pedidoEnEspera).toBeUndefined();
});

test('tienda "Cerrada" manual: bloqueado aunque acepte el aviso', async () => {
  horario.mockResolvedValue({ ...H, estado_tienda: 'closed' });
  jest.setSystemTime(co(19, 15));
  const { next, res } = await llamar({ acepto_espera: true });
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(403);
});

test('fuera de horario SIN aceptar el aviso: rechazado (409) con el texto de la apertura', async () => {
  jest.setSystemTime(co(19, 22, 5));
  const { next, res, cuerpo } = await llamar({});
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(409);
  expect(cuerpo).toMatchObject({ codigo: 'REQUIERE_AVISO', data: { texto_dia: 'mañana martes 20', texto_hora: '1:00 PM' } });
});

test('aceptar con algo que no es true (ej. "true" en texto) no cuenta', async () => {
  jest.setSystemTime(co(19, 22, 5));
  const { res } = await llamar({ acepto_espera: 'true' });
  expect(res.status).toHaveBeenCalledWith(409);
});

test('antes de abrir CON el aviso aceptado: pasa y la apertura es hoy a la 1 PM', async () => {
  jest.setSystemTime(co(19, 9));
  const { next, req } = await llamar({ acepto_espera: true });
  expect(next).toHaveBeenCalled();
  expect(req.pedidoEnEspera.fechaApertura.toISOString()).toBe('2026-10-19T18:00:00.000Z');
});

test('después de cerrar CON el aviso aceptado: la apertura es mañana a la 1 PM', async () => {
  jest.setSystemTime(co(19, 22, 5));
  const { next, req } = await llamar({ acepto_espera: true });
  expect(next).toHaveBeenCalled();
  expect(req.pedidoEnEspera.fechaApertura.toISOString()).toBe('2026-10-20T18:00:00.000Z');
});
