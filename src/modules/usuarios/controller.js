const service = require('./service');
const { crearUsuarioSchema, actualizarUsuarioSchema } = require('./schema');
const { success } = require('../../utils/response');

const listar   = async (req, res, next) => { try { success(res, await service.listar()); } catch (e) { next(e); } };
const buscar   = async (req, res, next) => { try { success(res, await service.buscar(req.query.q || '')); } catch (e) { next(e); } };
const obtener  = async (req, res, next) => { try { success(res, await service.obtener(Number(req.params.id))); } catch (e) { next(e); } };

const crear = async (req, res, next) => {
  try { success(res, await service.crear(crearUsuarioSchema.parse(req.body)), 'Usuario creado', 201); }
  catch (e) { next(e); }
};
const actualizar = async (req, res, next) => {
  try { success(res, await service.actualizar(Number(req.params.id), actualizarUsuarioSchema.parse(req.body)), 'Usuario actualizado'); }
  catch (e) { next(e); }
};
const eliminar = async (req, res, next) => {
  try { await service.eliminar(Number(req.params.id)); success(res, null, 'Usuario eliminado'); }
  catch (e) { next(e); }
};
const activarDesactivar = async (req, res, next) => {
  try {
    const { estado } = req.body;
    success(res, await service.activarDesactivar(Number(req.params.id), estado), 'Estado cambiado');
  }
  catch (e) { next(e); }
};
const asignarRol = async (req, res, next) => {
  try {
    const { id_rol } = req.body;
    success(res, await service.asignarRol(Number(req.params.id), id_rol), 'Rol asignado');
  } catch (e) { next(e); }
};

module.exports = { listar, buscar, obtener, crear, actualizar, eliminar, activarDesactivar, asignarRol };
