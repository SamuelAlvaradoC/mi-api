const { z } = require('zod');

const loginSchema = z.object({
  email:     z.string().email('Email inválido'),
  contrasena: z.string().min(6, 'Mínimo 6 caracteres'),
});

const registerSchema = z.object({
  nombre:    z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email:     z.string().email('Ingresa un correo electrónico válido'),
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  id_rol:    z.number().int().positive(),
});

const recuperarSchema = z.object({
  email: z.string().email(),
});

const cambiarContrasenaSchema = z.object({
  token:            z.string().min(10),
  nueva_contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

const telefonoCol = z.string()
  .regex(/^3[0-9]{9}$/, 'El teléfono debe ser un número colombiano válido de 10 dígitos (ej: 3001234567)')
  .optional()
  .or(z.literal(''));

const editarPerfilSchema = z.object({
  nombre:   z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  email:    z.string().email('Ingresa un correo electrónico válido').optional(),
  telefono: telefonoCol,
});

const solicitarResetSchema = z.object({
  email: z.string().email('Email inválido'),
});

const verificarResetSchema = z.object({
  email:           z.string().email('Email inválido'),
  codigo:          z.string().length(6, 'El código debe tener 6 dígitos'),
  nueva_password:  z.string().min(8, 'Mínimo 8 caracteres'),
});

const crearDireccionSchema = z.object({
  direccion_linea: z.string().min(1, 'La dirección es requerida'),
  barrio:          z.string().optional().nullable(),
  ciudad:          z.string().optional().nullable(),
  departamento:    z.string().optional().nullable(),
  referencia:      z.string().optional().nullable(),
  lat:             z.number().optional().nullable(),
  lng:             z.number().optional().nullable(),
  id_barrio:       z.number().int().positive().optional().nullable(),
});

module.exports = { loginSchema, registerSchema, recuperarSchema, cambiarContrasenaSchema, editarPerfilSchema,
                   solicitarResetSchema, verificarResetSchema, crearDireccionSchema };
