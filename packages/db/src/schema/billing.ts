import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const billingComprobantes = sqliteTable(
  "billing_comprobantes",
  {
    id: text("id").primaryKey(),
    ventaId: text("venta_id").notNull(),
    tipo: text("tipo", { enum: ["BOLETA", "FACTURA"] }).notNull(),
    serie: text("serie").notNull(),
    correlativo: integer("correlativo").notNull(),
    receptorTipoDoc: text("receptor_tipo_doc", { enum: ["DNI", "RUC"] }).notNull(),
    receptorNumeroDoc: text("receptor_numero_doc").notNull(),
    receptorRazonSocial: text("receptor_razon_social").notNull(),
    lineasJson: text("lineas_json").notNull(),
    valorVentaCentimos: integer("valor_venta_centimos").notNull(),
    igvCentimos: integer("igv_centimos").notNull(),
    totalCentimos: integer("total_centimos").notNull(),
    montoLetras: text("monto_letras").notNull(),
    estadoSunat: text("estado_sunat", { enum: ["PENDIENTE", "ACEPTADO", "RECHAZADO", "ERROR", "ANULADO"] }).notNull(),
    sunatCodigo: text("sunat_codigo"),
    sunatDescripcion: text("sunat_descripcion"),
    // XML firmado y CDR guardados para auditoría/reimpresión — nunca se regeneran tras el envío.
    xmlBase64: text("xml_base64"),
    cdrBase64: text("cdr_base64"),
    usuarioId: text("usuario_id").notNull(),
    creadoEn: text("creado_en").notNull(),
    enviadoEn: text("enviado_en"),
  },
  (t) => [uniqueIndex("ux_comprobante_serie").on(t.serie, t.correlativo)],
);

export const billingBajas = sqliteTable("billing_bajas", {
  id: text("id").primaryKey(),
  comprobanteId: text("comprobante_id")
    .notNull()
    .references(() => billingComprobantes.id),
  correlativo: integer("correlativo").notNull(),
  motivo: text("motivo").notNull(),
  ticket: text("ticket"),
  estadoSunat: text("estado_sunat", { enum: ["PENDIENTE", "ACEPTADO", "RECHAZADO", "ERROR"] }).notNull(),
  sunatCodigo: text("sunat_codigo"),
  sunatDescripcion: text("sunat_descripcion"),
  xmlBase64: text("xml_base64"),
  cdrBase64: text("cdr_base64"),
  usuarioId: text("usuario_id").notNull(),
  creadoEn: text("creado_en").notNull(),
  resueltoEn: text("resuelto_en"),
});
