const service = require('./service');
const { crearCategoriaSchema, estadoCategoriaSchema } = require('./schema');
const { success } = require('../../utils/response');

const listar       = async (req, res, next) => { try { success(res, await service.listar()); } catch (e) { next(e); } };
const buscar       = async (req, res, next) => { try { success(res, await service.buscar(req.query.q || '')); } catch (e) { next(e); } };
const obtener      = async (req, res, next) => { try { success(res, await service.obtener(Number(req.params.id))); } catch (e) { next(e); } };
const crear        = async (req, res, next) => {
  try { success(res, await service.crear(crearCategoriaSchema.parse(req.body)), 'Categoría creada', 201); }
  catch (e) { next(e); }
};
const actualizar   = async (req, res, next) => {
  try { success(res, await service.actualizar(Number(req.params.id), crearCategoriaSchema.partial().parse(req.body)), 'Categoría actualizada'); }
  catch (e) { next(e); }
};
const eliminar     = async (req, res, next) => {
  try { await service.eliminar(Number(req.params.id)); success(res, null, 'Categoría eliminada'); }
  catch (e) { next(e); }
};
const cambiarEstado = async (req, res, next) => {
  try {
    const { estado } = estadoCategoriaSchema.parse(req.body);
    success(res, await service.cambiarEstado(Number(req.params.id), estado), 'Estado actualizado');
  } catch (e) { next(e); }
};

module.exports = { listar, buscar, obtener, crear, actualizar, eliminar, cambiarEstado };
