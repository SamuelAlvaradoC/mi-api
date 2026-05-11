const service = require('./service');
const { crearVentaSchema, estadoVentaSchema, anularVentaSchema } = require('./schema');
const { success } = require('../../utils/response');

const listar       = async (req, res, next) => { try { success(res, await service.listar({ estado: req.query.estado, fecha: req.query.fecha })); } catch (e) { next(e); } };
const filtrar      = async (req, res, next) => { try { success(res, await service.filtrar(req.query.estado)); } catch (e) { next(e); } };
const obtener      = async (req, res, next) => { try { success(res, await service.obtener(Number(req.params.id))); } catch (e) { next(e); } };
const crear        = async (req, res, next) => { try { success(res, await service.crear(crearVentaSchema.parse(req.body)), 'Venta creada', 201); } catch (e) { next(e); } };
const cambiarEstado= async (req, res, next) => { try { const parsed = estadoVentaSchema.parse(req.body); success(res, await service.cambiarEstado(Number(req.params.id), parsed, req.user?.id_usuario), 'Estado actualizado'); } catch (e) { next(e); } };
const anular       = async (req, res, next) => { try { success(res, await service.anular(Number(req.params.id), anularVentaSchema.parse(req.body).motivo_anulacion), 'Venta anulada'); } catch (e) { next(e); } };
const comprobante  = async (req, res, next) => { try { success(res, await service.comprobante(Number(req.params.id))); } catch (e) { next(e); } };
const whatsapp     = async (req, res, next) => { try { success(res, await service.whatsapp(Number(req.params.id))); } catch (e) { next(e); } };
const totalVenta   = async (req, res, next) => { try { success(res, await service.totalVenta(Number(req.params.id))); } catch (e) { next(e); } };

const misVentas    = async (req, res, next) => { try { success(res, await service.misVentas(req.user.id_usuario)); } catch (e) { next(e); } };
const crearMiPedido= async (req, res, next) => { try { success(res, await service.crearMiPedido(req.user.id_usuario, req.body), 'Pedido creado', 201); } catch (e) { next(e); } };

const editar = async (req, res, next) => { try { success(res, await service.editar(Number(req.params.id), req.body), 'Venta actualizada'); } catch (e) { next(e); } };

module.exports = { listar, filtrar, obtener, crear, cambiarEstado, anular, comprobante, whatsapp, totalVenta, misVentas, crearMiPedido, editar };
