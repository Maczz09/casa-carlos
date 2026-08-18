import { z } from "zod";

export const PaymentMethodSchema = z.enum([
  "EFECTIVO",
  "YAPE",
  "PLIN",
  "LEMON",
  "AGORA",
  "TRANSFERENCIA",
  "POS_CREDITO",
  "POS_DEBITO",
]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const PaymentStateSchema = z.enum(["PENDIENTE", "ACEPTADO", "RECHAZADO"]);
export type PaymentState = z.infer<typeof PaymentStateSchema>;

export const PaymentSchema = z.object({
  id: z.string(),
  ventaId: z.string(),
  totalCentimos: z.number().int().positive(),
  estado: PaymentStateSchema,
  motivoRechazo: z.string().nullable(),
  aceptadoPor: z.string().nullable(),
  aceptadoEn: z.string().nullable(),
  creadoEn: z.string(),
});
export type Payment = z.infer<typeof PaymentSchema>;

export const PaymentDetailSchema = z.object({
  id: z.string(),
  pagoId: z.string(),
  metodo: PaymentMethodSchema,
  montoCentimos: z.number().int().positive(),
  codigoOperacion: z.string().nullable(),
  ordenanteNombres: z.string().nullable(),
  ordenanteApellidos: z.string().nullable(),
  bancoOrigen: z.string().nullable(),
  recibidoCentimos: z.number().int().nullable(),
  vueltoCentimos: z.number().int().nullable(),
  creadoEn: z.string(),
});
export type PaymentDetail = z.infer<typeof PaymentDetailSchema>;

export const PaymentWithDetailsSchema = PaymentSchema.extend({
  detalles: z.array(PaymentDetailSchema),
});
export type PaymentWithDetails = z.infer<typeof PaymentWithDetailsSchema>;

export const CollectionAccountSchema = z.object({
  id: z.string(),
  tipo: z.enum(["BANCO", "BILLETERA"]),
  proveedor: z.string(),
  titular: z.string(),
  numeroCuenta: z.string().nullable(),
  cci: z.string().nullable(),
  qrImagenUrl: z.string().nullable(),
  orden: z.number().int(),
  activa: z.boolean(),
});
export type CollectionAccount = z.infer<typeof CollectionAccountSchema>;
