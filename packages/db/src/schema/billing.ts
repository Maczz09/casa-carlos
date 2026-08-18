import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const billingComprobantes = sqliteTable(
  "billing_comprobantes",
  {
    id: text("id").primaryKey(),
    ventaId: text("venta_id").notNull(),
    tipo: text("tipo", { enum: ["BOLETA", "FACTURA", "NOTA_CREDITO", "NOTA_DEBITO"] }).notNull(),
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
    // Las tres columnas siguientes solo se llenan en una nota (tipo NOTA_CREDITO/NOTA_DEBITO) — null en boleta/factura.
    comprobanteAfectadoId: text("comprobante_afectado_id").references((): AnySQLiteColumn => billingComprobantes.id),
    /** Código catálogo 09 (nota de crédito) o 10 (nota de débito) de SUNAT. */
    motivoCodigo: text("motivo_codigo"),
    motivoDescripcion: text("motivo_descripcion"),
  },
  (t) => [uniqueIndex("ux_comprobante_serie").on(t.serie, t.correlativo)],
);

/**
 * Un contador atómico por serie (boleta, factura, cada serie de nota, y la
 * comunicación de baja bajo la clave `"RA"`). Reemplaza el patrón anterior
 * de `SELECT MAX(correlativo)+1` en JS, que no es atómico: dos requests
 * concurrentes pueden leer el mismo MAX antes de que cualquiera inserte,
 * generando dos comprobantes con el mismo correlativo. `UPDATE ... SET
 * valor = valor + 1 ... RETURNING valor` es una sola sentencia atómica —
 * soportado nativamente por SQLite desde 3.35 (incluido en `node:sqlite`),
 * no hace falta Postgres para esto.
 */
export const billingCorrelativos = sqliteTable("billing_correlativos", {
  serie: text("serie").primaryKey(),
  valor: integer("valor").notNull(),
});

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
