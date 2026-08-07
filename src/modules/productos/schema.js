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
  permite_salsas:    z.union([z.boolean(), z.number().int().min(0).max(1)]).optional().default(false),
  es_bowl:           z.union([z.boolean(), z.number().int().min(0).max(1)]).optional().default(false),
  img:               z.string().max(255).optional().nullable(),
});

const actualizarProductoSchema = crearProductoSchema.partial().extend({
  estado: z.number().int().min(0).max(1).optional(),
});

const estadoProductoSchema = z.object({
  estado: z.number().int().min(0).max(1),
});

module.exports = { crearProductoSchema, actualizarProductoSchema, estadoProductoSchema };
