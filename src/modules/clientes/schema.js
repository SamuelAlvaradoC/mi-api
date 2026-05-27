const { z } = require('zod');

const crearClienteSchema = z.object({
  nombre:    z.string().min(2),
  email:     z.string().email(),
  contrasena: z.string().min(6),
  direccion: z.string().max(255).optional(),
  barrio:    z.string().max(100).optional(),
  ciudad:    z.string().max(100).optional(),
  telefono:  z.string().max(20).optional(),
});

const actualizarClienteSchema = z.object({
  nombre:     z.string().min(2).max(100).optional(),
  email:      z.string().email().optional(),
  telefono:   z.string().max(20).optional(),
  direccion:  z.string().max(255).optional(),
  barrio:     z.string().max(100).optional(),
  ciudad:     z.string().max(100).optional(),
});

const crearDireccionSchema = z.object({
  direccion_linea: z.string().min(3).max(255),
  barrio:          z.string().max(100).optional(),
  ciudad:          z.string().max(100).optional(),
  departamento:    z.string().max(100).optional(),
  lat:             z.number().optional(),
  lng:             z.number().optional(),
  referencia:      z.string().max(255).optional(),
});

module.exports = { crearClienteSchema, actualizarClienteSchema, crearDireccionSchema };
