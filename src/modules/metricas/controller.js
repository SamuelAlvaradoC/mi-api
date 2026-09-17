const service = require('./service');
const { success } = require('../../utils/response');

const resumen = async (req, res, next) => {
  try {
    const mes = req.query.mes ? Number(req.query.mes) : undefined;
    success(res, await service.resumen(mes));
  } catch (e) { next(e); }
};

const registros = async (req, res, next) => {
  try {
    const granularidad = req.query.granularidad === 'mes' ? 'mes' : 'dia';
    const mes = req.query.mes ? Number(req.query.mes) : undefined;
    success(res, await service.registros(granularidad, mes));
  } catch (e) { next(e); }
};

const clientesFrecuencia = async (req, res, next) => {
  try {
    const { q, page, pageSize } = req.query;
    success(res, await service.clientesFrecuencia({
      q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    }));
  } catch (e) { next(e); }
};

module.exports = { resumen, registros, clientesFrecuencia };
