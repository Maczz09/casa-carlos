import { z } from "zod";

/** Catálogo 01 de SUNAT: 03 = Boleta de venta, 01 = Factura. */
export const DocumentTypeSchema = z.enum(["BOLETA", "FACTURA"]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

/** Catálogo 06 de SUNAT (subconjunto que usamos): 1 = DNI, 6 = RUC. */
export const RecipientDocTypeSchema = z.enum(["DNI", "RUC"]);
export type RecipientDocType = z.infer<typeof RecipientDocTypeSchema>;

export const SunatStatusSchema = z.enum(["PENDIENTE", "ACEPTADO", "RECHAZADO", "ERROR", "ANULADO"]);
export type SunatStatus = z.infer<typeof SunatStatusSchema>;

/** Estado de una Comunicación de Baja — el envío es asíncrono (sendSummary + ticket + getStatus). */
export const BajaStatusSchema = z.enum(["PENDIENTE", "ACEPTADO", "RECHAZADO", "ERROR"]);
export type BajaStatus = z.infer<typeof BajaStatusSchema>;

export const ComunicacionBajaSchema = z.object({
  id: z.string(),
  comprobanteId: z.string(),
  correlativo: z.number().int().positive(),
  motivo: z.string(),
  ticket: z.string().nullable(),
  estadoSunat: BajaStatusSchema,
  sunatCodigo: z.string().nullable(),
  sunatDescripcion: z.string().nullable(),
  usuarioId: z.string(),
  creadoEn: z.string(),
  resueltoEn: z.string().nullable(),
});
export type ComunicacionBaja = z.infer<typeof ComunicacionBajaSchema>;

export const ComprobanteLineSchema = z.object({
  descripcion: z.string(),
  cantidad: z.number().int().positive(),
  /** Incluye IGV — igual que el resto del sistema, los precios se manejan con impuesto incluido. */
  precioUnitarioCentimos: z.number().int().nonnegative(),
  subtotalCentimos: z.number().int().nonnegative(),
});
export type ComprobanteLine = z.infer<typeof ComprobanteLineSchema>;

export const ComprobanteSchema = z.object({
  id: z.string(),
  ventaId: z.string(),
  tipo: DocumentTypeSchema,
  serie: z.string(),
  correlativo: z.number().int().positive(),
  receptorTipoDoc: RecipientDocTypeSchema,
  receptorNumeroDoc: z.string(),
  receptorRazonSocial: z.string(),
  lineas: z.array(ComprobanteLineSchema),
  valorVentaCentimos: z.number().int().nonnegative(),
  igvCentimos: z.number().int().nonnegative(),
  totalCentimos: z.number().int().nonnegative(),
  montoLetras: z.string(),
  estadoSunat: SunatStatusSchema,
  sunatCodigo: z.string().nullable(),
  sunatDescripcion: z.string().nullable(),
  usuarioId: z.string(),
  creadoEn: z.string(),
  enviadoEn: z.string().nullable(),
});
export type Comprobante = z.infer<typeof ComprobanteSchema>;
