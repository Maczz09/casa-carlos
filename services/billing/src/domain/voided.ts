import { codigoTipoDocumento } from "./series.js";
import type { EmisorInfo } from "./ubl.js";
import { SIGNATURE_ANCHOR_ID } from "./ubl.js";
import type { DocumentType } from "@casacarlos/contracts";

export interface VoidedLineInput {
  tipo: DocumentType;
  serie: string;
  correlativo: number;
  motivo: string;
}

export interface VoidedDocumentsInput {
  correlativo: number;
  /** Fecha en que se genera esta comunicación (YYYY-MM-DD) — puede ser distinta a la de emisión de los documentos anulados. */
  fechaGeneracion: string;
  /** Fecha de emisión de los documentos anulados — todos deben compartir la misma (regla de SUNAT: una baja agrupa un solo día). */
  fechaReferencia: string;
  emisor: EmisorInfo;
  lineas: VoidedLineInput[];
}

const cdata = (text: string): string => `<![CDATA[${text}]]>`;

function yyyymmdd(fecha: string): string {
  return fecha.replaceAll("-", "");
}

/** El nombre de archivo (sin extensión) para la Comunicación de Baja: `{RUC}-RA-{fechaGeneracionYYYYMMDD}-{correlativo}`. */
export function bajaFileName(ruc: string, fechaGeneracion: string, correlativo: number): string {
  return `${ruc}-RA-${yyyymmdd(fechaGeneracion)}-${correlativo}`;
}

/**
 * XML de Comunicación de Baja (`VoidedDocuments`) — no es parte del estándar
 * UBL genérico, es una extensión propia de SUNAT (UBL versión declarada
 * "2.0" incluso en documentos que por lo demás siguen UBL 2.1). Se envía
 * por `sendSummary`, no por `sendBill`.
 */
export function buildVoidedDocumentsXml(input: VoidedDocumentsInput): string {
  const lines = input.lineas
    .map(
      (l, idx) => `
  <sac:VoidedDocumentsLine>
    <cbc:LineID>${idx + 1}</cbc:LineID>
    <cbc:DocumentTypeCode>${codigoTipoDocumento(l.tipo)}</cbc:DocumentTypeCode>
    <sac:DocumentSerialID>${l.serie}</sac:DocumentSerialID>
    <sac:DocumentNumberID>${l.correlativo}</sac:DocumentNumberID>
    <sac:VoidReasonDescription>${cdata(l.motivo)}</sac:VoidReasonDescription>
  </sac:VoidedDocumentsLine>`,
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<VoidedDocuments xmlns="urn:sunat:names:specification:ubl:peru:schema:xsd:VoidedDocuments-1" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2" xmlns:sac="urn:sunat:names:specification:ubl:peru:schema:xsd:SunatAggregateComponents-1">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent></ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.0</cbc:UBLVersionID>
  <cbc:CustomizationID>1.0</cbc:CustomizationID>
  <cbc:ID>RA-${yyyymmdd(input.fechaGeneracion)}-${input.correlativo}</cbc:ID>
  <cbc:ReferenceDate>${input.fechaReferencia}</cbc:ReferenceDate>
  <cbc:IssueDate>${input.fechaGeneracion}</cbc:IssueDate>
  <cac:Signature>
    <cbc:ID>${input.emisor.ruc}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${input.emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${cdata(input.emisor.nombreComercial)}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#${SIGNATURE_ANCHOR_ID}</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cbc:CustomerAssignedAccountID>${input.emisor.ruc}</cbc:CustomerAssignedAccountID>
    <cbc:AdditionalAccountID>6</cbc:AdditionalAccountID>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(input.emisor.razonSocial)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>${lines}
</VoidedDocuments>`;
}
