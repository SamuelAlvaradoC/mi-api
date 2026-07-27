const service = require('./service');
const { success } = require('../../utils/response');

const listar       = async (req, res, next) => { try { success(res, await service.listar()); } catch (e) { next(e); } };
const listarActivas= async (req, res, next) => { try { success(res, await service.listarActivas()); } catch (e) { next(e); } };
const obtener      = async (req, res, next) => { try { success(res, await service.obtener(Number(req.params.id))); } catch (e) { next(e); } };
const crear        = async (req, res, next) => { try { success(res, await service.crear(req.body), 'Ciudad creada', 201); } catch (e) { next(e); } };
const actualizar   = async (req, res, next) => { try { success(res, await service.actualizar(Number(req.params.id), req.body), 'Ciudad actualizada'); } catch (e) { next(e); } };
const eliminar     = async (req, res, next) => { try { await service.eliminar(Number(req.params.id)); success(res, null, 'Ciudad eliminada'); } catch (e) { next(e); } };
const cambiarEstado= async (req, res, next) => { try { success(res, await service.cambiarEstado(Number(req.params.id), req.body.estado), 'Estado actualizado'); } catch (e) { next(e); } };

module.exports = { listar, listarActivas, obtener, crear, actualizar, eliminar, cambiarEstado };
