const { z } = require('zod');
const crearToppingSchema = z.object({
  nombre:      z.string().min(2).max(100),
  descripcion: z.string().max(150).optional(),
  img:         z.string().max(255).optional(),
  gramaje:     z.string().max(50).optional(),
});

const estadoToppingSchema = z.object({
  estado: z.number().int().min(0).max(1),
});

module.exports = { crearToppingSchema, estadoToppingSchema };
