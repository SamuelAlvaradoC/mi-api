const service = require('./service');
const { crearClienteSchema, actualizarClienteSchema, crearDireccionSchema, estadoClienteSchema } = require('./schema');
const { success } = require('../../utils/response');

const listar            = async (req, res, next) => { try { success(res, await service.listar()); } catch (e) { next(e); } };
const crear             = async (req, res, next) => { try { success(res, await service.crear(crearClienteSchema.parse(req.body)), 'Cliente creado', 201); } catch (e) { next(e); } };
const buscar            = async (req, res, next) => { try { success(res, await service.buscar(req.query.q || '')); } catch (e) { next(e); } };
const obtener           = async (req, res, next) => { try { success(res, await service.obtener(Number(req.params.id))); } catch (e) { next(e); } };
const actualizar        = async (req, res, next) => { try { success(res, await service.actualizar(Number(req.params.id), actualizarClienteSchema.parse(req.body)), 'Cliente actualizado'); } catch (e) { next(e); } };
const eliminar          = async (req, res, next) => { try { await service.eliminar(Number(req.params.id)); success(res, null, 'Cliente eliminado'); } catch (e) { next(e); } };
const cambiarEstado     = async (req, res, next) => { try { success(res, await service.cambiarEstado(Number(req.params.id), estadoClienteSchema.parse(req.body).estado), 'Estado actualizado'); } catch (e) { next(e); } };
const historialPedidos  = async (req, res, next) => { try { success(res, await service.historialPedidos(Number(req.params.id))); } catch (e) { next(e); } };
const toppingsFavoritos = async (req, res, next) => { try { success(res, await service.toppingsFavoritos(Number(req.params.id))); } catch (e) { next(e); } };
const adicionesFavoritas= async (req, res, next) => { try { success(res, await service.adicionesFavoritas(Number(req.params.id))); } catch (e) { next(e); } };
const perfil            = async (req, res, next) => { try { success(res, await service.perfil(Number(req.params.id))); } catch (e) { next(e); } };
const detalleAdmin      = async (req, res, next) => { try { success(res, await service.detalleAdmin(Number(req.params.id))); } catch (e) { next(e); } };
const listarDirecciones = async (req, res, next) => { try { success(res, await service.listarDirecciones(Number(req.params.id))); } catch (e) { next(e); } };
const crearDireccion    = async (req, res, next) => { try { success(res, await service.crearDireccion(Number(req.params.id), crearDireccionSchema.parse(req.body)), 'Dirección creada', 201); } catch (e) { next(e); } };
const editarDireccion   = async (req, res, next) => { try { success(res, await service.editarDireccion(Number(req.params.id), Number(req.params.id_direccion), crearDireccionSchema.parse(req.body)), 'Dirección actualizada'); } catch (e) { next(e); } };

module.exports = { listar, crear, buscar, obtener, actualizar, eliminar, cambiarEstado,
  historialPedidos, toppingsFavoritos, adicionesFavoritas, perfil, detalleAdmin, listarDirecciones, crearDireccion, editarDireccion };
