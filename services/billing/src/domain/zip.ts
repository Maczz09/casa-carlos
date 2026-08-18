import JSZip from "jszip";
import type { DocumentType } from "@casacarlos/contracts";
import { codigoTipoDocumento } from "./series.js";

/** `{RUC}-{tipoDoc}-{serie}-{correlativo}` — la convención de nombre que SUNAT exige, sin extensión. */
export function comprobanteFileName(ruc: string, tipo: DocumentType, serie: string, correlativo: number): string {
  return `${ruc}-${codigoTipoDocumento(tipo)}-${serie}-${correlativo}`;
}

/** El nombre del ZIP es idéntico al del XML que contiene, solo cambia la extensión. */
export async function zipXml(fileName: string, xml: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(`${fileName}.xml`, xml);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Lee la Constancia de Recepción (CDR) que SUNAT devuelve — un ZIP con un único XML dentro. */
export async function unzipSingleXml(zipBuffer: Buffer): Promise<{ fileName: string; xml: string } | null> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const entry = Object.values(zip.files).find((f) => !f.dir && f.name.endsWith(".xml"));
  if (!entry) return null;
  const xml = await entry.async("string");
  return { fileName: entry.name, xml };
}
