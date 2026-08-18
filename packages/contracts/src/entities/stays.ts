import { z } from "zod";

export const CustomerSchema = z.object({
  id: z.string(),
  nombres: z.string().min(1),
  apellidos: z.string().min(1),
  dni: z.string().min(1),
  telefono: z.string().nullable(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const StayTypeSchema = z.enum(["RESERVA", "DIRECTA"]);
export type StayType = z.infer<typeof StayTypeSchema>;

export const StayStateSchema = z.enum([
  "RESERVADA",
  "EN_CURSO",
  "EN_TOLERANCIA",
  "EXCEDIDA",
  "FINALIZADA",
  "ANULADA",
]);
export type StayState = z.infer<typeof StayStateSchema>;

export const StaySchema = z.object({
  id: z.string(),
  cuartoId: z.string(),
  clienteId: z.string(),
  modalidadId: z.string(),
  ventaId: z.string().nullable(),
  tipo: StayTypeSchema,
  estado: StayStateSchema,
  bloqueoDesde: z.string(),
  bloqueoHasta: z.string(),
  checkinPrevisto: z.string(),
  checkinReal: z.string().nullable(),
  checkoutPrevisto: z.string(),
  checkoutReal: z.string().nullable(),
  noches: z.number().int().nonnegative(),
  toleranciaMin: z.number().int().nonnegative(),
  notificadoExcesoEn: z.string().nullable(),
  motivoAnulacion: z.string().nullable(),
  usuarioId: z.string(),
  creadoEn: z.string(),
});
export type Stay = z.infer<typeof StaySchema>;

export const StayWithCustomerSchema = StaySchema.extend({
  cliente: CustomerSchema,
});
export type StayWithCustomer = z.infer<typeof StayWithCustomerSchema>;
