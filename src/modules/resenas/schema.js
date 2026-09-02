const { z } = require('zod');
const { sanitizeTexto, sanitizeTextoOpcional, noQuedeVacioTrasSanitizar } = require('../../utils/sanitizeTexto');

const crearResenaSchema = z.object({
  sede:                  z.string().min(1).max(50).transform(sanitizeTexto).refine(noQuedeVacioTrasSanitizar, 'Campo requerido'),
  frecuencia:            z.string().min(1).max(50).transform(sanitizeTexto).refine(noQuedeVacioTrasSanitizar, 'Campo requerido'),
  calificacion_atencion: z.number().int().min(1).max(5),
  calificacion_producto: z.number().int().min(1).max(5),
  recomendaria:          z.string().min(1).max(20).transform(sanitizeTexto).refine(noQuedeVacioTrasSanitizar, 'Campo requerido'),
  tiempo_adecuado:       z.string().min(1).max(30).transform(sanitizeTexto).refine(noQuedeVacioTrasSanitizar, 'Campo requerido'),
  lo_que_gusto:          z.string().max(2000).optional().transform(sanitizeTextoOpcional),
  producto_deseado:      z.string().max(2000).optional().transform(sanitizeTextoOpcional),
  mejora:                z.string().max(2000).optional().transform(sanitizeTextoOpcional),
});

module.exports = { crearResenaSchema };
