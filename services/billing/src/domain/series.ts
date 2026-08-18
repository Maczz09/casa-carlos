import type { ComprobanteTipo, DocumentType, NotaTipo } from "@casacarlos/contracts";

/** Series fijas — una por tipo de comprobante, como es práctica estándar para un negocio de un solo local. */
export const SERIE_BOLETA = "B001";
export const SERIE_FACTURA = "F001";
/** Clave interna del contador de correlativo para la Comunicación de Baja — no es una "serie" SUNAT (esos documentos no tienen una), solo la clave que usa `billing_correlativos`. */
export const SERIE_BAJA = "RA";

/**
 * Series de notas — SUNAT exige 4 contadores independientes, no uno por
 * tipo de nota. El prefijo (F/B) debe coincidir con el tipo del documento
 * AFECTADO, no con el tipo de la nota: una nota de crédito contra una
 * factura usa FC01 aunque "crédito" no tenga F/B propio.
 */
export const SERIE_NOTA_CREDITO_FACTURA = "FC01";
export const SERIE_NOTA_CREDITO_BOLETA = "BC01";
export const SERIE_NOTA_DEBITO_FACTURA = "FD01";
export const SERIE_NOTA_DEBITO_BOLETA = "BD01";

export function serieForTipo(tipo: DocumentType): string {
  return tipo === "FACTURA" ? SERIE_FACTURA : SERIE_BOLETA;
}

/** Serie de una nota, determinada por su tipo Y por el tipo del documento que afecta (ver comentario arriba). */
export function serieForNota(tipoNota: NotaTipo, tipoDocumentoAfectado: DocumentType): string {
  if (tipoNota === "NOTA_CREDITO") {
    return tipoDocumentoAfectado === "FACTURA" ? SERIE_NOTA_CREDITO_FACTURA : SERIE_NOTA_CREDITO_BOLETA;
  }
  return tipoDocumentoAfectado === "FACTURA" ? SERIE_NOTA_DEBITO_FACTURA : SERIE_NOTA_DEBITO_BOLETA;
}

/** Catálogo 01 de SUNAT — boleta/factura. */
export function codigoTipoDocumento(tipo: DocumentType): "01" | "03" {
  return tipo === "FACTURA" ? "01" : "03";
}

/** Catálogo 01 de SUNAT — usado solo para el nombre de archivo del envío; el XML de la nota comunica su tipo a través del elemento raíz (`<CreditNote>`/`<DebitNote>`), no repite este código adentro. */
export function codigoTipoNota(tipo: NotaTipo): "07" | "08" {
  return tipo === "NOTA_CREDITO" ? "07" : "08";
}

/** Catálogo 01 de SUNAT para cualquiera de los 4 tipos que puede tomar un `Comprobante` — usado por `comprobanteFileName`/el QR, que necesitan el código sin importar si es boleta/factura o nota. */
export function codigoTipoComprobante(tipo: ComprobanteTipo): "01" | "03" | "07" | "08" {
  if (tipo === "NOTA_CREDITO" || tipo === "NOTA_DEBITO") return codigoTipoNota(tipo);
  return codigoTipoDocumento(tipo);
}
