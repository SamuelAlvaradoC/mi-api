const { z } = require('zod');
const { noContengaHtml, MSG_HTML } = require('../../utils/validarSinHtml');

const asignarDomicilioSchema = z.object({
  id_venta:             z.number().int().positive(),
  id_empleado:          z.number().int().positive(),
  id_estado_domicilio:  z.number().int().positive(),
  observaciones:        z.string().trim().max(255).optional().refine(noContengaHtml, MSG_HTML),
});

const estadoDomicilioSchema = z.object({
  id_estado_domicilio: z.number().int().positive(),
  hora_salida:         z.string().datetime().optional(),
  hora_entrega:        z.string().datetime().optional(),
  observaciones:       z.string().trim().max(255).optional().refine(noContengaHtml, MSG_HTML),
});

module.exports = { asignarDomicilioSchema, estadoDomicilioSchema };
