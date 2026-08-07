const { z } = require('zod');

const crearBarrioSchema = z.object({
  nombre:           z.string().min(2).max(100),
  id_ciudad:        z.number().int().positive(),
  precio_domicilio: z.number().positive(),
});

const estadoBarrioSchema = z.object({
  estado: z.number().int().min(0).max(1),
});

module.exports = { crearBarrioSchema, estadoBarrioSchema };
