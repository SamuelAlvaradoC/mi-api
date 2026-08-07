const service = require('./service');
const { crearProductoSchema, actualizarProductoSchema, estadoProductoSchema } = require('./schema');
const { success } = require('../../utils/response');

const listar       = async (req, res, next) => { try { success(res, await service.listar()); } catch (e) { next(e); } };
const buscar       = async (req, res, next) => { try { success(res, await service.buscar(req.query.q || '')); } catch (e) { next(e); } };
const filtrar      = async (req, res, next) => { try { success(res, await service.filtrar(req.query.categoria)); } catch (e) { next(e); } };
const obtener      = async (req, res, next) => { try { success(res, await service.obtener(Number(req.params.id))); } catch (e) { next(e); } };
const crear        = async (req, res, next) => { try { success(res, await service.crear(crearProductoSchema.parse(req.body)), 'Producto creado', 201); } catch (e) { next(e); } };
const actualizar   = async (req, res, next) => { try { success(res, await service.actualizar(Number(req.params.id), actualizarProductoSchema.parse(req.body)), 'Producto actualizado'); } catch (e) { next(e); } };
const eliminar     = async (req, res, next) => { try { await service.eliminar(Number(req.params.id)); success(res, null, 'Producto eliminado'); } catch (e) { next(e); } };
const cambiarEstado = async (req, res, next) => { try { success(res, await service.cambiarEstado(Number(req.params.id), estadoProductoSchema.parse(req.body).estado), 'Estado actualizado'); } catch (e) { next(e); } };

module.exports = { listar, buscar, filtrar, obtener, crear, actualizar, eliminar, cambiarEstado };
