const { z } = require('zod');

const crearResenaSchema = z.object({
  sede:                  z.string().min(1).max(50),
  frecuencia:            z.string().min(1).max(50),
  calificacion_atencion: z.number().int().min(1).max(5),
  calificacion_producto: z.number().int().min(1).max(5),
  recomendaria:          z.string().min(1).max(20),
  tiempo_adecuado:       z.string().min(1).max(30),
  lo_que_gusto:          z.string().max(2000).optional(),
  producto_deseado:      z.string().max(2000).optional(),
  mejora:                z.string().max(2000).optional(),
});

module.exports = { crearResenaSchema };
