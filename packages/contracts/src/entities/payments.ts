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

/** Billeteras digitales que el hotel puede cobrar. Cada una es también un `PaymentMethod`. */
export const WalletProviderSchema = z.enum(["YAPE", "PLIN", "LEMON", "AGORA"]);
export type WalletProvider = z.infer<typeof WalletProviderSchema>;

export const WALLET_PROVIDERS = WalletProviderSchema.options;

/**
 * Un canal por el que el hotel cobra: una billetera digital (con su QR) o una
 * cuenta bancaria (con su número y CCI). Es lo que administra Ajustes → Cobros
 * y lo que el kiosco le muestra al huésped, así que el hotel puede tener
 * varias cuentas de varios bancos y varias billeteras a la vez.
 *
 * `metodo` es el `PaymentMethod` con el que se registra el pago cobrado por
 * este canal: la billetera cobra con su propio método (YAPE/PLIN/…) y toda
 * cuenta bancaria cobra como TRANSFERENCIA.
 */
export const CollectionAccountSchema = z.object({
  id: z.string(),
  tipo: z.enum(["BANCO", "BILLETERA"]),
  metodo: PaymentMethodSchema,
  /** Nombre de la billetera (YAPE, PLIN…) o del banco (BCP, Interbank, una caja municipal…). */
  proveedor: z.string(),
  titular: z.string(),
  /** Número al que llega el yapeo/plineo. Las billeteras se identifican por teléfono, no por cuenta. */
  telefono: z.string().nullable(),
  numeroCuenta: z.string().nullable(),
  cci: z.string().nullable(),
  /** Indicación libre para el huésped ("cuenta soles", "poner el número de cuarto en el mensaje"…). */
  notas: z.string().nullable(),
  /** Nombre opaco del archivo dentro de data/qr-images. */
  qrArchivo: z.string().nullable(),
  /** Foto del QR de la billetera servida por el propio servidor, o null si no se cargó ninguna. */
  qrUrl: z.string().nullable(),
  orden: z.number().int(),
  activa: z.boolean(),
});
export type CollectionAccount = z.infer<typeof CollectionAccountSchema>;
