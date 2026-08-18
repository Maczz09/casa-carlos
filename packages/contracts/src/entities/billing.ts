import { z } from "zod";

/** Catálogo 01 de SUNAT: 03 = Boleta de venta, 01 = Factura. Boleta/factura únicamente — ver `NotaTipoSchema`/`ComprobanteTipoSchema` para las notas. */
export const DocumentTypeSchema = z.enum(["BOLETA", "FACTURA"]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

/** Catálogo 01 de SUNAT: 07 = Nota de crédito, 08 = Nota de débito. */
export const NotaTipoSchema = z.enum(["NOTA_CREDITO", "NOTA_DEBITO"]);
export type NotaTipo = z.infer<typeof NotaTipoSchema>;

export interface MotivoNota {
  codigo: string;
  descripcion: string;
}

/** Catálogo 09 de SUNAT — motivos válidos para una nota de crédito. Fuente única compartida entre `services/billing` (valida) y el frontend (selector). */
export const MOTIVOS_NOTA_CREDITO: MotivoNota[] = [
  { codigo: "01", descripcion: "Anulación de la operación" },
  { codigo: "02", descripcion: "Anulación por error en el RUC" },
  { codigo: "03", descripcion: "Corrección por error en la descripción" },
  { codigo: "04", descripcion: "Descuento global" },
  { codigo: "05", descripcion: "Descuento por ítem" },
  { codigo: "06", descripcion: "Devolución total" },
  { codigo: "07", descripcion: "Devolución por ítem" },
  { codigo: "08", descripcion: "Bonificación" },
  { codigo: "09", descripcion: "Disminución en el valor" },
  { codigo: "10", descripcion: "Otros conceptos" },
];

/** Catálogo 10 de SUNAT — motivos válidos para una nota de débito. */
export const MOTIVOS_NOTA_DEBITO: MotivoNota[] = [
  { codigo: "01", descripcion: "Intereses por mora" },
  { codigo: "02", descripcion: "Aumento en el valor" },
  { codigo: "03", descripcion: "Penalidades / otros conceptos" },
];

/** Unión de los cuatro tipos que puede tomar una fila de `billing_comprobantes` — boleta/factura son comprobantes propios, las notas siempre están contra otro comprobante (`comprobanteAfectadoId`). */
export const ComprobanteTipoSchema = z.enum(["BOLETA", "FACTURA", "NOTA_CREDITO", "NOTA_DEBITO"]);
export type ComprobanteTipo = z.infer<typeof ComprobanteTipoSchema>;

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
  tipo: ComprobanteTipoSchema,
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
  /** Solo presente en una nota — el comprobante (boleta/factura) que corrige. `null` en boleta/factura. */
  comprobanteAfectadoId: z.string().nullable(),
  /** Código catálogo 09 (nota de crédito) o 10 (nota de débito) de SUNAT — `null` en boleta/factura. */
  motivoCodigo: z.string().nullable(),
  motivoDescripcion: z.string().nullable(),
});
export type Comprobante = z.infer<typeof ComprobanteSchema>;

/** Input para emitir una nota de crédito o débito contra un comprobante ya `ACEPTADO`. */
export const IssueNotaInputSchema = z.object({
  motivoCodigo: z.string(),
  motivoDescripcion: z.string(),
  lineas: z.array(ComprobanteLineSchema).min(1),
});
export type IssueNotaInput = z.infer<typeof IssueNotaInputSchema>;
