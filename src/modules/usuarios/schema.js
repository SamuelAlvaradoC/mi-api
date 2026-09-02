const { z } = require('zod');
const { sanitizeTexto, noQuedeVacioTrasSanitizar } = require('../../utils/sanitizeTexto');
const MSG_NOMBRE_VACIO = 'El nombre no puede quedar vacío';

const crearUsuarioSchema = z.object({
  nombre: z.string().min(2).transform(sanitizeTexto).refine(noQuedeVacioTrasSanitizar, MSG_NOMBRE_VACIO),
  email: z.string().email(),
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  id_rol: z.number().int().positive(),
  estado: z.number().int().min(0).max(1).default(1),
  // Solo aplica si el rol resulta ser 'cliente' — se usa para el perfil
  // Cliente vinculado, nunca se escribe en Usuario (no tiene esa columna).
  telefono: z.string().max(20).optional(),
});

const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(2).transform(sanitizeTexto).refine(noQuedeVacioTrasSanitizar, MSG_NOMBRE_VACIO).optional(),
  email: z.string().email().optional(),
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').optional(),
  id_rol: z.number().int().positive().optional(),
  estado: z.number().int().min(0).max(1).optional(),
});

const estadoUsuarioSchema = z.object({
  estado: z.number().int().min(0).max(1),
});

const asignarRolSchema = z.object({
  id_rol: z.number().int().positive(),
});

module.exports = { crearUsuarioSchema, actualizarUsuarioSchema, estadoUsuarioSchema, asignarRolSchema };
