const service = require('./service');
const { crearResenaSchema } = require('./schema');
const { success } = require('../../utils/response');

const crear = async (req, res, next) => {
  try {
    const datos = crearResenaSchema.parse(req.body);
    const id_usuario = req.user?.id_usuario || null;
    const resena = await service.crear({ ...datos, id_usuario });
    success(res, resena, 'Reseña registrada', 201);
  } catch (e) { next(e); }
};

const listar = async (req, res, next) => {
  try {
    const lista = await service.listar();
    success(res, lista);
  } catch (e) { next(e); }
};

const resumen = async (req, res, next) => {
  try {
    const data = await service.resumen();
    success(res, data);
  } catch (e) { next(e); }
};

module.exports = { crear, listar, resumen };
