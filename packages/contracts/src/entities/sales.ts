import { z } from "zod";

export const SaleTypeSchema = z.enum(["COTIZACION", "VENTA"]);
export type SaleType = z.infer<typeof SaleTypeSchema>;

export const SaleStateSchema = z.enum([
  "BORRADOR",
  "ABIERTA",
  "PAGADA",
  "CON_SALDO",
  "CERRADA",
  "ANULADA",
]);
export type SaleState = z.infer<typeof SaleStateSchema>;

export const SaleSchema = z.object({
  id: z.string(),
  serie: z.string(),
  correlativo: z.number().int().positive(),
  tipo: SaleTypeSchema,
  estado: SaleStateSchema,
  estadiaId: z.string().nullable(),
  cuartoId: z.string().nullable(),
  clienteNombres: z.string().nullable(),
  clienteApellidos: z.string().nullable(),
  clienteDni: z.string().nullable(),
  totalCentimos: z.number().int().nonnegative(),
  pagadoCentimos: z.number().int().nonnegative(),
  saldoCentimos: z.number().int(),
  usuarioId: z.string(),
  pagadaEn: z.string().nullable(),
  cerradaEn: z.string().nullable(),
  motivoAnulacion: z.string().nullable(),
  creadoEn: z.string(),
});
export type Sale = z.infer<typeof SaleSchema>;

export const LineTypeSchema = z.enum(["HOSPEDAJE", "PRODUCTO", "CARGO_EXTRA"]);
export type LineType = z.infer<typeof LineTypeSchema>;

export const LinePhaseSchema = z.enum(["PRE_PAGO", "POST_PAGO"]);
export type LinePhase = z.infer<typeof LinePhaseSchema>;

export const SaleLineSchema = z.object({
  id: z.string(),
  ventaId: z.string(),
  tipo: LineTypeSchema,
  referenciaId: z.string().nullable(),
  descripcion: z.string(),
  cantidad: z.number().int().positive(),
  precioUnitarioCentimos: z.number().int().nonnegative(),
  subtotalCentimos: z.number().int().nonnegative(),
  fase: LinePhaseSchema,
  anulada: z.boolean(),
  motivoAnulacion: z.string().nullable(),
  usuarioId: z.string(),
  creadoEn: z.string(),
});
export type SaleLine = z.infer<typeof SaleLineSchema>;

export const SaleWithLinesSchema = SaleSchema.extend({
  lineas: z.array(SaleLineSchema),
});
export type SaleWithLines = z.infer<typeof SaleWithLinesSchema>;
