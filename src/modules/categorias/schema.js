const { z } = require('zod');

const crearCategoriaSchema = z.object({
  nombre:      z.string().min(2).max(100),
  descripcion: z.string().max(150).optional(),
});

const estadoCategoriaSchema = z.object({
  estado: z.number().int().min(0).max(1),
});

module.exports = { crearCategoriaSchema, estadoCategoriaSchema };
