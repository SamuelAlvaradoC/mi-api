const { z } = require('zod');

const crearCiudadSchema = z.object({
  nombre: z.string().min(2).max(100),
});

const estadoCiudadSchema = z.object({
  estado: z.number().int().min(0).max(1),
});

module.exports = { crearCiudadSchema, estadoCiudadSchema };
