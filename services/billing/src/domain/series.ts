import type { DocumentType } from "@casacarlos/contracts";

/** Series fijas — una por tipo de comprobante, como es práctica estándar para un negocio de un solo local. */
export const SERIE_BOLETA = "B001";
export const SERIE_FACTURA = "F001";

export function serieForTipo(tipo: DocumentType): string {
  return tipo === "BOLETA" ? SERIE_BOLETA : SERIE_FACTURA;
}

/** Catálogo 01 de SUNAT. */
export function codigoTipoDocumento(tipo: DocumentType): "01" | "03" {
  return tipo === "FACTURA" ? "01" : "03";
}
