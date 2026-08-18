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
  diferenciaCentimos: z.number().int().nullable(),
  justificacion: z.string().nullable(),
  estado: ShiftStateSchema,
});
export type Shift = z.infer<typeof ShiftSchema>;

export const CashMovementTypeSchema = z.enum(["APERTURA", "VENTA", "INGRESO", "EGRESO", "VUELTO", "CIERRE"]);
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
