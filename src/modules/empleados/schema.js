const { z } = require('zod');

const crearEmpleadoSchema = z.object({
  nombre:        z.string().min(2),
  email:         z.string().email(),
  contrasena:    z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  id_rol:        z.number().int().positive().default(2),
  cargo:         z.string().max(50),
  fecha_ingreso: z.string(),
});

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

module.exports = { crearEmpleadoSchema, actualizarEmpleadoSchema, estadoEmpleadoSchema };
