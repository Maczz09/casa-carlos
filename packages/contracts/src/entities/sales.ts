import { z } from "zod";
import type { PaymentWithDetails } from "./payments.js";
import type { CashMovement, Shift } from "./cashbox.js";
import type { StayWithCustomer } from "./stays.js";
import type { PaymentMethod } from "./payments.js";

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
  cuartoNumero: z.string().nullable().optional(),
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
  intervaloMinutos: z.number().int().positive().nullable().optional(),
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

export interface SaleHistory {
  venta: SaleWithLines;
  estadia: StayWithCustomer | null;
  pagos: Array<PaymentWithDetails & { usuarioNombre: string }>;
  movimientos: Array<CashMovement & { usuarioNombre: string }>;
  turnos: Shift[];
  auditoria: Array<{
    id: string; entidad: string; entidadId: string; accion: string;
    usuarioId: string | null; usuarioNombre: string; ocurridoEn: string;
    motivo: string | null; antesJson: string | null; despuesJson: string | null;
  }>;
}

export interface CheckoutPreview {
  estadiaId: string; ventaId: string; horaSalida: string; revision: string;
  anularHorasExtra: boolean; requiereConfirmacion: boolean;
  totalAntesCentimos: number; totalDespuesCentimos: number;
  saldoAntesCentimos: number; saldoDespuesCentimos: number;
  devolverCentimos: number;
  devoluciones: Array<{ metodo: PaymentMethod; montoCentimos: number }>;
  cambios: Array<{ lineaId: string | null; descripcion: string; antesCentimos: number; despuesCentimos: number }>;
}

export interface CheckoutConfirmation {
  horaSalida: string; revision: string; anularHorasExtra: boolean;
  motivo: string; confirmarDevolucion?: boolean;
}

export interface CheckoutResult { finalizada: boolean; estadia: StayWithCustomer; venta: SaleWithLines }

export interface CancelledSale extends Sale {
  anuladoPorUsuarioId?: string | null;
  anuladoPorNombre?: string | null;
  anuladoEn?: string | null;
  correlationId?: string | null;
  idempotencyKey?: string | null;
  lineas?: SaleLine[];
}

