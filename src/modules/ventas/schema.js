const { z } = require('zod');

const itemVentaSchema = z.object({
  id_producto:     z.number().int().positive(),
  cantidad:        z.number().int().positive(),
  max_toppings:    z.number().int().min(0).optional(),
  precio_unitario: z.number().optional(),
  chocolate:       z.string().optional().nullable(),
  salsas: z.array(z.union([z.string(), z.number()])).optional().default([]),
  toppings: z.array(
    z.union([
      z.number().int().positive(),
      z.object({
        id_topping: z.number().int().positive(),
        cantidad:   z.number().int().positive().default(1),
      }),
    ])
  ).optional().default([]),
  adiciones: z.array(
    z.union([
      z.number().int().positive(),
      z.object({
        id_adicion: z.number().int().positive(),
        cantidad:   z.number().int().positive().default(1),
      }),
    ])
  ).optional().default([]),
});

const nuevaDireccionSchema = z.object({
  direccion_linea: z.string().min(1),
  barrio:          z.string().optional().nullable(),
  ciudad:          z.string().optional().nullable(),
  departamento:    z.string().optional().nullable(),
  referencia:      z.string().optional().nullable(),
  id_barrio:       z.number().int().positive().optional().nullable(),
});

const crearVentaSchema = z.object({
  id_cliente:          z.number().int().positive(),
  id_direccion:        z.number().int().positive().optional(),
  nueva_direccion:     nuevaDireccionSchema.optional(),
  costo_domicilio:     z.number().min(0).default(0),
  // Solo el panel admin puede pedir explícitamente que se respete el
  // costo_domicilio mandado en vez del precio del barrio (ej: promoción
  // puntual). Este campo NO existe en crearMiPedidoSchema — un cliente nunca
  // puede activarlo.
  override_costo_domicilio: z.boolean().optional().default(false),
  observaciones:       z.string().optional().nullable(),
  metodo_pago:         z.string().optional().nullable(),
  monto_efectivo:      z.number().min(0).optional().nullable(),
  monto_transferencia: z.number().min(0).optional().nullable(),
  comprobante_url:     z.string().url().optional().or(z.literal('')).nullable(),
  items:               z.array(itemVentaSchema).min(1, 'Debe incluir al menos un producto'),
  puntos_usados:       z.number().int().min(0).optional().default(0),
});

const crearMiPedidoSchema = z.object({
  id_direccion:        z.number().int().positive().optional(),
  nueva_direccion:     nuevaDireccionSchema.optional(),
  costo_domicilio:     z.number().min(0).default(0),
  observaciones:       z.string().optional().nullable(),
  metodo_pago:         z.string().optional().nullable(),
  monto_efectivo:      z.number().min(0).optional().nullable(),
  monto_transferencia: z.number().min(0).optional().nullable(),
  comprobante_url:     z.string().url().optional().or(z.literal('')).nullable(),
  items:               z.array(itemVentaSchema).min(1, 'Debe incluir al menos un producto'),
  puntos_a_usar:       z.number().int().min(0).optional().default(0),
}).refine((d) => d.id_direccion !== undefined || d.nueva_direccion !== undefined, {
  message: 'Debe seleccionar o registrar una dirección de entrega',
});

const estadoVentaSchema = z.object({
  id_estado:           z.number().int().positive().optional(),
  nombre_estado:       z.string().optional(),
  metodo_pago:         z.string().optional(),
  monto_efectivo:      z.number().min(0).optional(),
  monto_transferencia: z.number().min(0).optional(),
  comprobante_url:     z.string().url().optional().or(z.literal('')).nullable(),
  motivo_anulacion:    z.string().optional(),
}).refine((d) => d.id_estado !== undefined || d.nombre_estado !== undefined, {
  message: 'Debe proporcionar id_estado o nombre_estado',
});

const anularVentaSchema = z.object({
  motivo_anulacion: z.string().min(5, 'Debe indicar el motivo de anulación'),
});

// items/costo_domicilio son opcionales porque una venta "entregada" solo
// permite cambiar el método de pago (ver ventas/service.js editar()).
const editarVentaSchema = z.object({
  items:               z.array(itemVentaSchema).optional(),
  costo_domicilio:     z.number().min(0).optional(),
  override_costo_domicilio: z.boolean().optional().default(false),
  metodo_pago:         z.string().optional().nullable(),
  monto_efectivo:      z.number().min(0).optional().nullable(),
  monto_transferencia: z.number().min(0).optional().nullable(),
  nombre_cliente:      z.string().optional().nullable(),
  telefono_cliente:    z.string().optional().nullable(),
});

module.exports = { crearVentaSchema, crearMiPedidoSchema, estadoVentaSchema, anularVentaSchema, editarVentaSchema };
