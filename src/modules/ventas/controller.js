const service = require('./service');
const { crearVentaSchema, crearMiPedidoSchema, estadoVentaSchema, anularVentaSchema, editarVentaSchema } = require('./schema');
const { success } = require('../../utils/response');

const listar       = async (req, res, next) => { try { success(res, await service.listar({ estado: req.query.estado, fecha: req.query.fecha })); } catch (e) { next(e); } };
const filtrar      = async (req, res, next) => { try { success(res, await service.filtrar(req.query.estado)); } catch (e) { next(e); } };
const obtener      = async (req, res, next) => { try { success(res, await service.obtener(Number(req.params.id))); } catch (e) { next(e); } };
const crear        = async (req, res, next) => { try { success(res, await service.crear(crearVentaSchema.parse(req.body)), 'Venta creada', 201); } catch (e) { next(e); } };
// PATCH /:id/estado acepta varios permisos amplios (cocina, domicilio, confirmador),
// pero anular es una acción sensible propia — exige anular_venta explícitamente
// aunque el usuario tenga alguno de los otros permisos de la ruta.
const cambiarEstado = async (req, res, next) => {
  try {
    const parsed = estadoVentaSchema.parse(req.body);
    const prisma = require('../../config/prisma');
    let nombreDestino = parsed.nombre_estado;
    if (!nombreDestino && parsed.id_estado) {
      const estado = await prisma.estado.findUnique({ where: { id_estado: parsed.id_estado } });
      nombreDestino = estado?.nombre_estado;
    }
    if (nombreDestino === 'anulado') {
      const tienePermiso = await prisma.rolPermiso.findFirst({
        where: { id_rol: req.user.id_rol, permiso: { nombre: 'anular_venta' } },
      });
      if (!tienePermiso) {
        return res.status(403).json({ success: false, data: null, message: 'No tienes permiso para anular ventas' });
      }
    }
    success(res, await service.cambiarEstado(Number(req.params.id), parsed, req.user?.id_usuario), 'Estado actualizado');
  } catch (e) { next(e); }
};
const anular       = async (req, res, next) => { try { success(res, await service.anular(Number(req.params.id), anularVentaSchema.parse(req.body).motivo_anulacion), 'Venta anulada'); } catch (e) { next(e); } };
const comprobante  = async (req, res, next) => { try { success(res, await service.comprobante(Number(req.params.id))); } catch (e) { next(e); } };
const whatsapp     = async (req, res, next) => { try { success(res, await service.whatsapp(Number(req.params.id))); } catch (e) { next(e); } };
const totalVenta   = async (req, res, next) => { try { success(res, await service.totalVenta(Number(req.params.id))); } catch (e) { next(e); } };

const misVentas    = async (req, res, next) => { try { success(res, await service.misVentas(req.user.id_usuario)); } catch (e) { next(e); } };

// Panel domi: solo ve SUS ventas despachadas/entregadas (filtradas por id_domiciliario)
const misDespachos = async (req, res, next) => {
  try {
    const prisma = require('../../config/prisma');
    const empleado = await prisma.empleado.findUnique({ where: { id_usuario: req.user.id_usuario } });
    if (!empleado) return success(res, []);
    success(res, await service.listar({
      estado: req.query.estado,
      fecha:  req.query.fecha,
      id_domiciliario: empleado.id_empleado,
    }));
  } catch (e) { next(e); }
};
const crearMiPedido= async (req, res, next) => { try { success(res, await service.crearMiPedido(req.user.id_usuario, crearMiPedidoSchema.parse(req.body)), 'Pedido creado', 201); } catch (e) { next(e); } };

const editar = async (req, res, next) => { try { success(res, await service.editar(Number(req.params.id), editarVentaSchema.parse(req.body)), 'Venta actualizada'); } catch (e) { next(e); } };

module.exports = { listar, filtrar, obtener, crear, cambiarEstado, anular, comprobante, whatsapp, totalVenta, misVentas, crearMiPedido, editar, misDespachos };
