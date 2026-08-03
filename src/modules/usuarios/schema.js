const { z } = require('zod');

const crearUsuarioSchema = z.object({
  nombre: z.string().min(2),
  email: z.string().email(),
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  id_rol: z.number().int().positive(),
  estado: z.number().int().min(0).max(1).default(1),
});

const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(2).optional(),
  email: z.string().email().optional(),
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional(),
  id_rol: z.number().int().positive().optional(),
  estado: z.number().int().min(0).max(1).optional(),
});

module.exports = { crearUsuarioSchema, actualizarUsuarioSchema };
