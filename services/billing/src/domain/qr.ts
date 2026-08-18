import type { Comprobante } from "@casacarlos/contracts";
import QRCode from "qrcode";
import { codigoTipoDocumento } from "./series.js";
import { schemeIdReceptor } from "./ubl.js";

/**
 * Cadena que SUNAT exige codificar en el QR de la representación impresa:
 * RUC|tipoDoc|serie|número|IGV|total|fechaEmisión|tipoDocReceptor|numDocReceptor
 * (Anexo técnico SEE - Del Contribuyente, 9 campos separados por "|").
 */
export function buildQrPayload(comprobante: Comprobante, rucEmisor: string, fechaEmision: string): string {
  const fields = [
    rucEmisor,
    codigoTipoDocumento(comprobante.tipo),
    comprobante.serie,
    String(comprobante.correlativo),
    (comprobante.igvCentimos / 100).toFixed(2),
    (comprobante.totalCentimos / 100).toFixed(2),
    fechaEmision,
    schemeIdReceptor(comprobante.receptorTipoDoc),
    comprobante.receptorNumeroDoc,
  ];
  return fields.join("|");
}

export async function qrPngBuffer(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, { type: "png", margin: 1, scale: 4 });
}
