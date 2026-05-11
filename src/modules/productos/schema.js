const { z } = require('zod');

const crearProductoSchema = z.object({
  id_categoria:      z.number().int().positive(),
  nombre:            z.string().min(2).max(100),
  descripcion:       z.string().optional().nullable(),
  tamano:            z.string().max(20).optional().nullable(),
  precio:            z.number().positive(),
  permite_toppings:  z.number().int().min(0).max(1).default(0),
  max_toppings:      z.number().int().min(0).optional().nullable(),
  permite_chocolate: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional().default(false),
  img:               z.string().max(255).optional().nullable(),
});

const actualizarProductoSchema = crearProductoSchema.partial();

const crearCategoriaSchema = z.object({
  nombre:      z.string().min(2).max(100),
  descripcion: z.string().max(150).optional(),
});

const crearToppingSchema = z.object({
  nombre:      z.string().min(2).max(100),
  descripcion: z.string().max(150).optional(),
  img:         z.string().max(255).optional(),
});

const crearAdicionSchema = z.object({
  nombre:      z.string().min(2).max(100),
  descripcion: z.string().max(150).optional(),
  img:         z.string().max(255).optional(),
  precio:      z.number().positive(),
});

module.exports = {
  crearProductoSchema, actualizarProductoSchema,
  crearCategoriaSchema, crearToppingSchema, crearAdicionSchema,
};
