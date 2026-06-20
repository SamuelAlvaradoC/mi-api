const service = require('./service');
const { success } = require('../../utils/response');

const hoy = async (req, res, next) => {
  try { success(res, await service.obtenerCierreHoy()); } catch (e) { next(e); }
};

const crearBase = async (req, res, next) => {
  try {
    const data = await service.crearBase(req.user.id_usuario, req.body.base_inicial);
    success(res, data, 'Base inicial registrada', 201);
  } catch (e) { next(e); }
};

const agregarGasto = async (req, res, next) => {
  try {
    const data = await service.agregarGasto(req.user.id_usuario, req.body);
    success(res, data, 'Gasto agregado', 201);
  } catch (e) { next(e); }
};

const eliminarGasto = async (req, res, next) => {
  try { success(res, await service.eliminarGasto(req.params.id), 'Gasto eliminado'); } catch (e) { next(e); }
};

const resumen = async (req, res, next) => {
  try { success(res, await service.resumenDia()); } catch (e) { next(e); }
};

module.exports = { hoy, crearBase, agregarGasto, eliminarGasto, resumen };
