const service = require('./service');
const { z } = require('zod');
const { success } = require('../../utils/response');

const { contieneHtml, MSG_HTML } = require('../../utils/validarSinHtml');
const carrito = require('./carrito');

// Una línea del carrito: el mismo formato que se manda al crear el pedido.
const lineaSchema = z.object({
  id_producto: z.number().int().positive(),
  cantidad:    z.number().int().min(1).max(99),
  toppings:    z.array(z.object({ id_topping: z.number().int().positive(), cantidad: z.number().int().min(1).max(20).optional().default(1) })).max(30).optional().default([]),
  adiciones:   z.array(z.object({ id_adicion: z.number().int().positive(), cantidad: z.number().int().min(1).max(20).optional().default(1) })).max(30).optional().default([]),
  salsas:      z.array(z.union([z.string().max(60), z.number()]).transform(String)).max(10).optional().default([]),
  chocolate:   z.string().max(30).nullable().optional(),
  frutas:      z.string().max(40).nullable().optional(),
  observacion: z.string().max(300).nullable().optional().refine((v) => !contieneHtml(v), MSG_HTML),
});
const carritoSchema = z.object({ items: z.array(lineaSchema).max(50) });

// ── Catálogo (público) ──────────────────────────────────
const listarProductos        = async (req, res, next) => { try { success(res, await service.listarProductos()); } catch (e) { next(e); } };
const obtenerProducto        = async (req, res, next) => { try { success(res, await service.obtenerProducto(Number(req.params.id))); } catch (e) { next(e); } };
const listarCategorias       = async (req, res, next) => { try { success(res, await service.listarCategorias()); } catch (e) { next(e); } };
const buscar                 = async (req, res, next) => { try { success(res, await service.buscar(req.query.q || '')); } catch (e) { next(e); } };
const promociones            = async (req, res, next) => { try { success(res, await service.promociones()); } catch (e) { next(e); } };
const masPedidos              = async (req, res, next) => { try { success(res, await service.masPedidos()); } catch (e) { next(e); } };
const listarToppingsActivos  = async (req, res, next) => { try { success(res, await service.listarToppingsActivos()); } catch (e) { next(e); } };
const listarAdicionesActivas = async (req, res, next) => { try { success(res, await service.listarAdicionesActivas()); } catch (e) { next(e); } };

// ── Carrito ─────────────────────────────────────────────
// GET/PUT requieren sesión (es el carrito guardado del usuario); validar es
// público porque el carrito se arma sin iniciar sesión.
const getCarrito     = async (req, res, next) => { try { success(res, await carrito.obtener(req.user.id_usuario)); } catch (e) { next(e); } };
const guardarCarrito = async (req, res, next) => { try { success(res, await carrito.guardar(req.user.id_usuario, carritoSchema.parse(req.body).items)); } catch (e) { next(e); } };
const validarCarrito = async (req, res, next) => { try { success(res, await carrito.validar(carritoSchema.parse(req.body).items)); } catch (e) { next(e); } };

module.exports = { listarProductos, obtenerProducto, listarCategorias, buscar, promociones, masPedidos,
  listarToppingsActivos, listarAdicionesActivas,
  getCarrito, guardarCarrito, validarCarrito };
