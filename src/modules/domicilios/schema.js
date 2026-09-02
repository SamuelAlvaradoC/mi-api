const { z } = require('zod');
const { sanitizeTextoOpcional } = require('../../utils/sanitizeTexto');

const asignarDomicilioSchema = z.object({
  id_venta:             z.number().int().positive(),
  id_empleado:          z.number().int().positive(),
  id_estado_domicilio:  z.number().int().positive(),
  observaciones:        z.string().max(255).optional().transform(sanitizeTextoOpcional),
});

const estadoDomicilioSchema = z.object({
  id_estado_domicilio: z.number().int().positive(),
  hora_salida:         z.string().datetime().optional(),
  hora_entrega:        z.string().datetime().optional(),
  observaciones:       z.string().max(255).optional().transform(sanitizeTextoOpcional),
});

module.exports = { asignarDomicilioSchema, estadoDomicilioSchema };
