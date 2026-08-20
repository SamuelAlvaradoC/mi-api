const service = require('./service');
const { z } = require('zod');
const { success } = require('../../utils/response');

const agregarSchema = z.object({
  id_producto: z.number().int().positive(),
  cantidad:    z.number().int().positive(),
  toppings:    z.array(z.number().int().positive()).optional().default([]),
  adiciones:   z.array(z.object({ id_adicion: z.number().int().positive(), cantidad: z.number().int().positive() })).optional().default([]),
});

// ── Catálogo (público) ──────────────────────────────────
const listarProductos        = async (req, res, next) => { try { success(res, await service.listarProductos()); } catch (e) { next(e); } };
const obtenerProducto        = async (req, res, next) => { try { success(res, await service.obtenerProducto(Number(req.params.id))); } catch (e) { next(e); } };
const listarCategorias       = async (req, res, next) => { try { success(res, await service.listarCategorias()); } catch (e) { next(e); } };
const buscar                 = async (req, res, next) => { try { success(res, await service.buscar(req.query.q || '')); } catch (e) { next(e); } };
const promociones            = async (req, res, next) => { try { success(res, await service.promociones()); } catch (e) { next(e); } };
const masPedidos              = async (req, res, next) => { try { success(res, await service.masPedidos()); } catch (e) { next(e); } };
const listarToppingsActivos  = async (req, res, next) => { try { success(res, await service.listarToppingsActivos()); } catch (e) { next(e); } };
const listarAdicionesActivas = async (req, res, next) => { try { success(res, await service.listarAdicionesActivas()); } catch (e) { next(e); } };

// ── Carrito (requiere auth) ─────────────────────────────
const getCarrito    = (req, res, next) => { try { success(res, service.getCarrito(req.user.id_usuario)); } catch (e) { next(e); } };
const totalCarrito  = (req, res, next) => { try { success(res, service.totalCarrito(req.user.id_usuario)); } catch (e) { next(e); } };
const agregarItem   = async (req, res, next) => { try { success(res, await service.agregarItem(req.user.id_usuario, agregarSchema.parse(req.body)), 'Producto agregado al carrito', 201); } catch (e) { next(e); } };
const actualizarItem= (req, res, next) => { try { success(res, service.actualizarItem(req.user.id_usuario, Number(req.params.id), req.body), 'Carrito actualizado'); } catch (e) { next(e); } };
const eliminarItem  = (req, res, next) => { try { success(res, service.eliminarItem(req.user.id_usuario, Number(req.params.id)), 'Item eliminado'); } catch (e) { next(e); } };

module.exports = { listarProductos, obtenerProducto, listarCategorias, buscar, promociones, masPedidos,
  listarToppingsActivos, listarAdicionesActivas,
  getCarrito, totalCarrito, agregarItem, actualizarItem, eliminarItem };
