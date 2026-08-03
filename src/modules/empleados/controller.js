const service = require('./service');
const { actualizarEmpleadoSchema, estadoEmpleadoSchema } = require('./schema');
const { z } = require('zod');
const { success } = require('../../utils/response');

const crearEmpleadoSchema = z.object({
  nombre:        z.string().min(2),
  email:         z.string().email(),
  contrasena:    z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  id_rol:        z.number().int().positive().default(2),
  cargo:         z.string().max(50),
  fecha_ingreso: z.string(),
});

const listar       = async (req, res, next) => { try { success(res, await service.listar()); } catch (e) { next(e); } };
const buscar       = async (req, res, next) => { try { success(res, await service.buscar(req.query.q || '')); } catch (e) { next(e); } };
const obtener      = async (req, res, next) => { try { success(res, await service.obtener(Number(req.params.id))); } catch (e) { next(e); } };
const crear        = async (req, res, next) => { try { success(res, await service.crear(crearEmpleadoSchema.parse(req.body)), 'Empleado creado', 201); } catch (e) { next(e); } };
const actualizar   = async (req, res, next) => { try { success(res, await service.actualizar(Number(req.params.id), actualizarEmpleadoSchema.parse(req.body)), 'Empleado actualizado'); } catch (e) { next(e); } };
const eliminar     = async (req, res, next) => { try { await service.eliminar(Number(req.params.id)); success(res, null, 'Empleado eliminado'); } catch (e) { next(e); } };
const cambiarEstado = async (req, res, next) => { try { success(res, await service.cambiarEstado(Number(req.params.id), estadoEmpleadoSchema.parse(req.body).estado), 'Estado actualizado'); } catch (e) { next(e); } };

module.exports = { listar, buscar, obtener, crear, actualizar, eliminar, cambiarEstado };
