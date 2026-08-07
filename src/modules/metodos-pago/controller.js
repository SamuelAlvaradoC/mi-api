const service = require('./service');
const { z } = require('zod');
const { success } = require('../../utils/response');

const schema = z.object({ nombre: z.string().min(2).max(50), descripcion: z.string().max(150).optional() });
const estadoSchema = z.object({ estado: z.number().int().min(0).max(1) });

const listar       = async (req, res, next) => { try { success(res, await service.listar()); } catch (e) { next(e); } };
const crear        = async (req, res, next) => { try { success(res, await service.crear(schema.parse(req.body)), 'Método de pago creado', 201); } catch (e) { next(e); } };
const actualizar   = async (req, res, next) => { try { success(res, await service.actualizar(Number(req.params.id), schema.partial().parse(req.body)), 'Método de pago actualizado'); } catch (e) { next(e); } };
const cambiarEstado= async (req, res, next) => { try { success(res, await service.cambiarEstado(Number(req.params.id), estadoSchema.parse(req.body).estado), 'Estado actualizado'); } catch (e) { next(e); } };

module.exports = { listar, crear, actualizar, cambiarEstado };
