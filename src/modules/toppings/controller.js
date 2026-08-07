const service = require('./service');
const { crearToppingSchema, estadoToppingSchema } = require('./schema');
const { success } = require('../../utils/response');

const listar        = async (req, res, next) => { try { success(res, await service.listar()); } catch (e) { next(e); } };
const listarActivos = async (req, res, next) => { try { success(res, await service.listarActivos()); } catch (e) { next(e); } };
const obtener      = async (req, res, next) => { try { success(res, await service.obtener(Number(req.params.id))); } catch (e) { next(e); } };
const crear        = async (req, res, next) => { try { success(res, await service.crear(crearToppingSchema.parse(req.body)), 'Topping creado', 201); } catch (e) { next(e); } };
const actualizar   = async (req, res, next) => { try { success(res, await service.actualizar(Number(req.params.id), crearToppingSchema.partial().parse(req.body)), 'Topping actualizado'); } catch (e) { next(e); } };
const eliminar     = async (req, res, next) => { try { await service.eliminar(Number(req.params.id)); success(res, null, 'Topping eliminado'); } catch (e) { next(e); } };
const cambiarEstado = async (req, res, next) => { try { success(res, await service.cambiarEstado(Number(req.params.id), estadoToppingSchema.parse(req.body).estado), 'Estado actualizado'); } catch (e) { next(e); } };

module.exports = { listar, listarActivos, obtener, crear, actualizar, eliminar, cambiarEstado };
