import { z } from "zod";

export const KioskSessionStateSchema = z.enum([
  "ESPERA",
  "SELECCION_PISO",
  "SELECCION_CUARTO",
  "DATOS_CLIENTE",
  "SELECCION_PAGO",
  "PAGO_PENDIENTE",
  "ACEPTADO",
  "RECHAZADO",
]);
export type KioskSessionState = z.infer<typeof KioskSessionStateSchema>;

export const KioskCustomerSchema = z.object({
  nombres: z.string(),
  apellidos: z.string(),
  dni: z.string(),
  telefono: z.string().nullable().optional(),
});
export type KioskCustomer = z.infer<typeof KioskCustomerSchema>;

export const ProposedPaymentLineSchema = z.object({
  metodo: z.string(),
  montoCentimos: z.number().int().positive(),
});
export type ProposedPaymentLine = z.infer<typeof ProposedPaymentLineSchema>;

/**
 * The one thing both the kiosk terminal and reception look at — see
 * REGLAS-DE-NEGOCIO.md §10. Lives only in server memory, never in SQLite: a
 * kiosk transaction lasts minutes, so losing it on a restart is an
 * acceptable trade for not reconciling half-finished checkouts against
 * durable records. Shared here (not duplicated in each app) because it
 * crosses the wire to both `web-reception` and `web-kiosk`.
 */
export const KioskSessionSchema = z.object({
  id: z.string(),
  estado: KioskSessionStateSchema,
  actorActivo: z.enum(["CLIENTE", "RECEPCION"]),

  modalidadId: z.string().nullable(),
  bloques: z.number().int().positive(),
  noches: z.number().int().positive(),

  pisoId: z.string().nullable(),
  cuartoId: z.string().nullable(),
  preciosPorCategoria: z.record(z.string(), z.number()),

  cliente: KioskCustomerSchema.nullable(),

  stayId: z.string().nullable(),
  saleId: z.string().nullable(),
  totalCentimos: z.number().nullable(),

  propuestaPago: z.array(ProposedPaymentLineSchema).nullable(),
  paymentId: z.string().nullable(),

  usuarioId: z.string(),
  error: z.string().nullable(),
  creadaEn: z.string(),
  actualizadaEn: z.string(),
});
export type KioskSession = z.infer<typeof KioskSessionSchema>;
