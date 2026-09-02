const { z } = require('zod');
const { noContengaHtml, MSG_HTML } = require('../../utils/validarSinHtml');

const crearResenaSchema = z.object({
  sede:                  z.string().trim().min(1).max(50).refine(noContengaHtml, MSG_HTML),
  frecuencia:            z.string().trim().min(1).max(50).refine(noContengaHtml, MSG_HTML),
  calificacion_atencion: z.number().int().min(1).max(5),
  calificacion_producto: z.number().int().min(1).max(5),
  recomendaria:          z.string().trim().min(1).max(20).refine(noContengaHtml, MSG_HTML),
  tiempo_adecuado:       z.string().trim().min(1).max(30).refine(noContengaHtml, MSG_HTML),
  lo_que_gusto:          z.string().trim().max(2000).optional().refine(noContengaHtml, MSG_HTML),
  producto_deseado:      z.string().trim().max(2000).optional().refine(noContengaHtml, MSG_HTML),
  mejora:                z.string().trim().max(2000).optional().refine(noContengaHtml, MSG_HTML),
});

module.exports = { crearResenaSchema };
