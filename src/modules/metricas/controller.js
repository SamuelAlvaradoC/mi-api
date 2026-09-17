const service = require('./service');
const { success } = require('../../utils/response');

const resumen = async (req, res, next) => {
  try { success(res, await service.resumen()); } catch (e) { next(e); }
};

const clientesFrecuencia = async (req, res, next) => {
  try { success(res, await service.clientesFrecuencia()); } catch (e) { next(e); }
};

module.exports = { resumen, clientesFrecuencia };
