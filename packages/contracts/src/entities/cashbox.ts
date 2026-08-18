import { z } from "zod";
import { PaymentMethodSchema } from "./payments.js";

export const ShiftTemplateSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/),
  orden: z.number().int(),
  activa: z.boolean(),
});
export type ShiftTemplate = z.infer<typeof ShiftTemplateSchema>;

export const ShiftStateSchema = z.enum(["ABIERTO", "CERRADO"]);
export type ShiftState = z.infer<typeof ShiftStateSchema>;

/** Conteo de caja por denominación — clave es el valor de la denominación en céntimos ("20000" = S/200), valor es cuántos billetes/monedas de esa denominación hay. */
export const DenominacionesSchema = z.record(z.string(), z.number().int().nonnegative());
export type Denominaciones = z.infer<typeof DenominacionesSchema>;

export const ShiftSchema = z.object({
  id: z.string(),
  plantillaId: z.string().nullable(),
  usuarioId: z.string(),
  fecha: z.string(), // ISO date
  abiertoEn: z.string(),
  cerradoEn: z.string().nullable(),
  aperturaCentimos: z.number().int().nonnegative(),
  efectivoEsperadoCentimos: z.number().int().nullable(),
  efectivoDeclaradoCentimos: z.number().int().nullable(),
  denominacionesCierre: DenominacionesSchema.nullable(),
  diferenciaCentimos: z.number().int().nullable(),
  justificacion: z.string().nullable(),
  estado: ShiftStateSchema,
});
export type Shift = z.infer<typeof ShiftSchema>;

/** Conteo de caja a mitad de turno, sin cerrarlo — solo un registro, no cambia el estado del turno. */
export const ArqueoSchema = z.object({
  id: z.string(),
  turnoId: z.string(),
  denominaciones: DenominacionesSchema,
  totalCentimos: z.number().int(),
  efectivoEsperadoCentimos: z.number().int(),
  diferenciaCentimos: z.number().int(),
  usuarioId: z.string(),
  creadoEn: z.string(),
});
export type Arqueo = z.infer<typeof ArqueoSchema>;

export const CashMovementTypeSchema = z.enum(["APERTURA", "VENTA", "INGRESO", "EGRESO", "AJUSTE", "VUELTO", "CIERRE"]);
export type CashMovementType = z.infer<typeof CashMovementTypeSchema>;

export const CashMovementSchema = z.object({
  id: z.string(),
  turnoId: z.string(),
  tipo: CashMovementTypeSchema,
  metodo: PaymentMethodSchema.nullable(),
  montoCentimos: z.number().int(),
  ventaId: z.string().nullable(),
  pagoId: z.string().nullable(),
  vueltoCentimos: z.number().int().nullable(),
  motivo: z.string().nullable(),
  usuarioId: z.string(),
  ocurridoEn: z.string(),
});
export type CashMovement = z.infer<typeof CashMovementSchema>;

/** Resultado de un cuadre — por turno o por rango de fechas (CAJ-06, CAJ-08, CAJ-09). */
export const CashSummarySchema = z.object({
  aperturaCentimos: z.number().int(),
  efectivoEsperadoCentimos: z.number().int(),
  efectivoDeclaradoCentimos: z.number().int().nullable(),
  diferenciaCentimos: z.number().int().nullable(),
  porMetodo: z.array(z.object({ metodo: PaymentMethodSchema, totalCentimos: z.number().int(), cantidad: z.number().int() })),
  ingresosManualesCentimos: z.number().int(),
  egresosManualesCentimos: z.number().int(),
  vueltosCentimos: z.number().int(),
});
export type CashSummary = z.infer<typeof CashSummarySchema>;
