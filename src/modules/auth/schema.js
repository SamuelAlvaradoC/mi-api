const { z } = require('zod');
const { sanitizeTexto, sanitizeTextoOpcional, noQuedeVacioTrasSanitizar } = require('../../utils/sanitizeTexto');
const MSG_NOMBRE_VACIO = 'El nombre no puede quedar vacío';

const loginSchema = z.object({
  email:     z.string().trim().toLowerCase().email('Email inválido'),
  contrasena: z.string().min(6, 'Mínimo 6 caracteres'),
});

const registerSchema = z.object({
  nombre:    z.string().min(2, 'El nombre debe tener al menos 2 caracteres').transform(sanitizeTexto).refine(noQuedeVacioTrasSanitizar, MSG_NOMBRE_VACIO),
  email:     z.string().trim().toLowerCase().email('Ingresa un correo electrónico válido'),
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  id_rol:    z.number().int().positive(),
});

const telefonoCol = z.string()
  .regex(/^3[0-9]{9}$/, 'El teléfono debe ser un número colombiano válido de 10 dígitos (ej: 3001234567)')
  .optional()
  .or(z.literal(''));

const editarPerfilSchema = z.object({
  nombre:   z.string().min(2, 'El nombre debe tener al menos 2 caracteres').transform(sanitizeTexto).refine(noQuedeVacioTrasSanitizar, MSG_NOMBRE_VACIO).optional(),
  email:    z.string().trim().toLowerCase().email('Ingresa un correo electrónico válido').optional(),
  telefono: telefonoCol,
});

const solicitarResetSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
});

const verificarResetSchema = z.object({
  email:           z.string().trim().toLowerCase().email('Email inválido'),
  codigo:          z.string().length(6, 'El código debe tener 6 dígitos'),
  nueva_password:  z.string().min(8, 'Mínimo 8 caracteres'),
});

const crearDireccionSchema = z.object({
  direccion_linea: z.string().min(1, 'La dirección es requerida').transform(sanitizeTexto).refine(noQuedeVacioTrasSanitizar, 'La dirección no puede quedar vacía'),
  barrio:          z.string().optional().nullable().transform(sanitizeTextoOpcional),
  ciudad:          z.string().optional().nullable().transform(sanitizeTextoOpcional),
  departamento:    z.string().optional().nullable().transform(sanitizeTextoOpcional),
  referencia:      z.string().optional().nullable().transform(sanitizeTextoOpcional),
  id_barrio:       z.number().int().positive().optional().nullable(),
});

module.exports = { loginSchema, registerSchema, editarPerfilSchema,
                   solicitarResetSchema, verificarResetSchema, crearDireccionSchema };
