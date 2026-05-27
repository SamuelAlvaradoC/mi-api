const { z } = require('zod');

const actualizarEmpleadoSchema = z.object({
  nombre:        z.string().min(2).max(100).optional(),
  email:         z.string().email().optional(),
  cargo:         z.string().max(50).optional(),
  fecha_ingreso: z.string().optional(),
  estado:        z.number().int().min(0).max(1).optional(),
});

const estadoEmpleadoSchema = z.object({
  estado: z.number().int().min(0).max(1),
});

module.exports = { actualizarEmpleadoSchema, estadoEmpleadoSchema };
