const { z } = require('zod');

// direccion/barrio/ciudad de texto libre en Usuario NO se incluyen aquí a
// propósito: son legado del modelo previo a la tabla Direccion/Barrio (0 de 9
// clientes reales los tiene poblados) y ningún formulario real los edita —
// el modelo vigente es la relación Cliente.direcciones vía Direccion.
const crearClienteSchema = z.object({
  nombre:    z.string().min(2),
  email:     z.string().email(),
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  telefono:  z.string().max(20).optional(),
});

const actualizarClienteSchema = z.object({
  nombre:     z.string().min(2).max(100).optional(),
  email:      z.string().email().optional(),
  telefono:   z.string().max(20).optional(),
});

const crearDireccionSchema = z.object({
  direccion_linea: z.string().min(3).max(255),
  barrio:          z.string().max(100).optional(),
  ciudad:          z.string().max(100).optional(),
  departamento:    z.string().max(100).optional(),
  id_barrio:       z.number().int().positive().optional().nullable(),
  referencia:      z.string().max(255).optional(),
});

module.exports = { crearClienteSchema, actualizarClienteSchema, crearDireccionSchema };
