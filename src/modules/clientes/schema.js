const { z } = require('zod');
const { noContengaHtml, MSG_HTML } = require('../../utils/validarSinHtml');

// direccion/barrio/ciudad de texto libre en Usuario NO se incluyen aquí a
// propósito: son legado del modelo previo a la tabla Direccion/Barrio (0 de 9
// clientes reales los tiene poblados) y ningún formulario real los edita —
// el modelo vigente es la relación Cliente.direcciones vía Direccion.
const crearClienteSchema = z.object({
  nombre:    z.string().trim().min(2).refine(noContengaHtml, MSG_HTML),
  email:     z.string().email(),
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  telefono:  z.string().max(20).optional(),
});

const actualizarClienteSchema = z.object({
  nombre:     z.string().trim().min(2).max(100).refine(noContengaHtml, MSG_HTML).optional(),
  email:      z.string().email().optional(),
  telefono:   z.string().max(20).optional(),
});

const crearDireccionSchema = z.object({
  direccion_linea: z.string().trim().min(3).max(255).refine(noContengaHtml, MSG_HTML),
  barrio:          z.string().trim().max(100).optional().refine(noContengaHtml, MSG_HTML),
  ciudad:          z.string().trim().max(100).optional().refine(noContengaHtml, MSG_HTML),
  departamento:    z.string().trim().max(100).optional().refine(noContengaHtml, MSG_HTML),
  id_barrio:       z.number().int().positive().optional().nullable(),
  referencia:      z.string().trim().max(255).optional().refine(noContengaHtml, MSG_HTML),
});

const estadoClienteSchema = z.object({
  estado: z.number().int().min(0).max(1),
});

module.exports = { crearClienteSchema, actualizarClienteSchema, crearDireccionSchema, estadoClienteSchema };
