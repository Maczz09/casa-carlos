import type { DocumentType, RecipientDocType } from "@casacarlos/contracts";
import { codigoTipoDocumento } from "./series.js";

export interface EmisorInfo {
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  direccion: string;
  ubigeo: string;
  distrito: string;
  provincia: string;
  departamento: string;
}

export interface ReceptorInfo {
  tipoDoc: RecipientDocType;
  numeroDoc: string;
  razonSocial: string;
}

export interface UblLineInput {
  id: number;
  descripcion: string;
  cantidad: number;
  valorVentaUnitarioCentimos: number;
  precioUnitarioCentimos: number;
  valorVentaCentimos: number;
  igvCentimos: number;
  subtotalCentimos: number;
}

export interface UblDocumentInput {
  tipo: DocumentType;
  serie: string;
  correlativo: number;
  fechaEmision: string;
  horaEmision: string;
  emisor: EmisorInfo;
  receptor: ReceptorInfo;
  lineas: UblLineInput[];
  valorVentaCentimos: number;
  igvCentimos: number;
  totalCentimos: number;
  montoLetras: string;
}

/** El anchor que `signature.ts` usa para insertar el `ds:Signature` real dentro de `ext:UBLExtensions`. */
export const SIGNATURE_ANCHOR_ID = "CasaCarlosSignature";

const money = (centimos: number): string => (centimos / 100).toFixed(2);

const cdata = (text: string): string => `<![CDATA[${text}]]>`;

/** `schemeID` del Catálogo 06 de SUNAT: 1 = DNI, 6 = RUC. */
export function schemeIdReceptor(tipoDoc: RecipientDocType): "1" | "6" {
  return tipoDoc === "RUC" ? "6" : "1";
}

/**
 * Boleta/factura usan `<cac:InvoiceLine>`/`<cbc:InvoicedQuantity>`, nota de
 * crédito `<cac:CreditNoteLine>`/`<cbc:CreditedQuantity>`, nota de débito
 * `<cac:DebitNoteLine>`/`<cbc:DebitedQuantity>` — mismo contenido interno en
 * los tres casos, solo cambian estos dos nombres de elemento.
 */
function buildLine(l: UblLineInput, lineTag: string, quantityTag: string): string {
  return `
  <cac:${lineTag}>
    <cbc:ID>${l.id}</cbc:ID>
    <cbc:${quantityTag} unitCode="NIU">${l.cantidad}</cbc:${quantityTag}>
    <cbc:LineExtensionAmount currencyID="PEN">${money(l.valorVentaCentimos)}</cbc:LineExtensionAmount>
    <cac:PricingReference>
      <cac:AlternativeConditionPrice>
        <cbc:PriceAmount currencyID="PEN">${money(l.precioUnitarioCentimos)}</cbc:PriceAmount>
        <cbc:PriceTypeCode>01</cbc:PriceTypeCode>
      </cac:AlternativeConditionPrice>
    </cac:PricingReference>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="PEN">${money(l.igvCentimos)}</cbc:TaxAmount>
      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="PEN">${money(l.valorVentaCentimos)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="PEN">${money(l.igvCentimos)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>18</cbc:Percent>
          <cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>
          <cac:TaxScheme>
            <cbc:ID>1000</cbc:ID>
            <cbc:Name>IGV</cbc:Name>
            <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Description>${cdata(l.descripcion)}</cbc:Description>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="PEN">${money(l.valorVentaUnitarioCentimos)}</cbc:PriceAmount>
    </cac:Price>
  </cac:${lineTag}>`;
}

/**
 * Genera el XML UBL 2.1 sin firmar — `ext:ExtensionContent` queda vacío,
 * listo para que `signature.ts` inserte el `ds:Signature` real ahí dentro.
 * Estructura verificada contra ejemplos reales de Greenter (implementación
 * de referencia usada por cientos de negocios peruanos).
 */
export function buildInvoiceXml(doc: UblDocumentInput): string {
  const tipoDocCode = codigoTipoDocumento(doc.tipo);
  const paymentTerms =
    doc.tipo === "FACTURA"
      ? `
  <cac:PaymentTerms>
    <cbc:ID>FormaPago</cbc:ID>
    <cbc:PaymentMeansID>Contado</cbc:PaymentMeansID>
  </cac:PaymentTerms>`
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent></ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${doc.serie}-${doc.correlativo}</cbc:ID>
  <cbc:IssueDate>${doc.fechaEmision}</cbc:IssueDate>
  <cbc:IssueTime>${doc.horaEmision}</cbc:IssueTime>
  <cbc:InvoiceTypeCode listID="0101">${tipoDocCode}</cbc:InvoiceTypeCode>
  <cbc:Note languageLocaleID="1000">${cdata(doc.montoLetras)}</cbc:Note>
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
  <cac:Signature>
    <cbc:ID>${doc.emisor.ruc}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${doc.emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${cdata(doc.emisor.nombreComercial)}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#${SIGNATURE_ANCHOR_ID}</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${doc.emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${cdata(doc.emisor.nombreComercial)}</cbc:Name>
      </cac:PartyName>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(doc.emisor.razonSocial)}</cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:ID>${doc.emisor.ubigeo}</cbc:ID>
          <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
          <cbc:CityName>${doc.emisor.provincia}</cbc:CityName>
          <cbc:CountrySubentity>${doc.emisor.departamento}</cbc:CountrySubentity>
          <cbc:District>${doc.emisor.distrito}</cbc:District>
          <cac:AddressLine>
            <cbc:Line>${cdata(doc.emisor.direccion)}</cbc:Line>
          </cac:AddressLine>
          <cac:Country>
            <cbc:IdentificationCode>PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${schemeIdReceptor(doc.receptor.tipoDoc)}">${doc.receptor.numeroDoc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(doc.receptor.razonSocial)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>${paymentTerms}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${money(doc.igvCentimos)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${money(doc.valorVentaCentimos)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${money(doc.igvCentimos)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${money(doc.valorVentaCentimos)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${money(doc.totalCentimos)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${money(doc.totalCentimos)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${doc.lineas.map((l) => buildLine(l, "InvoiceLine", "InvoicedQuantity")).join("")}
</Invoice>`;
}

export interface DocumentoAfectadoInput {
  tipo: DocumentType;
  serie: string;
  correlativo: number;
}

export interface UblNotaInput {
  serie: string;
  correlativo: number;
  fechaEmision: string;
  emisor: EmisorInfo;
  receptor: ReceptorInfo;
  lineas: UblLineInput[];
  valorVentaCentimos: number;
  igvCentimos: number;
  totalCentimos: number;
  documentoAfectado: DocumentoAfectadoInput;
  /** Código catálogo 09 (nota de crédito) o 10 (nota de débito) de SUNAT. */
  motivoCodigo: string;
  motivoDescripcion: string;
}

/** `<cac:DiscrepancyResponse>` (motivo) + `<cac:BillingReference>` (a qué comprobante corrige) — el par de bloques que solo llevan las notas, no boleta/factura. */
function buildDiscrepancyAndReference(afectado: DocumentoAfectadoInput, motivoCodigo: string, motivoDescripcion: string): string {
  const idAfectado = `${afectado.serie}-${afectado.correlativo}`;
  return `
  <cac:DiscrepancyResponse>
    <cbc:ReferenceID>${idAfectado}</cbc:ReferenceID>
    <cbc:ResponseCode>${motivoCodigo}</cbc:ResponseCode>
    <cbc:Description>${cdata(motivoDescripcion)}</cbc:Description>
  </cac:DiscrepancyResponse>
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${idAfectado}</cbc:ID>
      <cbc:DocumentTypeCode>${codigoTipoDocumento(afectado.tipo)}</cbc:DocumentTypeCode>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`;
}

/** `<cac:Signature>` de una nota — mismo contenido que boleta/factura, la única diferencia real es el `cbc:ID` (usa el ID de la propia nota, no el del emisor). */
function buildNotaSignature(idNota: string, emisor: EmisorInfo): string {
  return `
  <cac:Signature>
    <cbc:ID>${idNota}</cbc:ID>
    <cac:SignatoryParty>
      <cac:PartyIdentification>
        <cbc:ID>${emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${cdata(emisor.nombreComercial)}</cbc:Name>
      </cac:PartyName>
    </cac:SignatoryParty>
    <cac:DigitalSignatureAttachment>
      <cac:ExternalReference>
        <cbc:URI>#${SIGNATURE_ANCHOR_ID}</cbc:URI>
      </cac:ExternalReference>
    </cac:DigitalSignatureAttachment>
  </cac:Signature>`;
}

/** `<cac:AccountingSupplierParty>`/`<cac:AccountingCustomerParty>` de una nota — misma estructura que boleta/factura, **sin** `<cac:PaymentTerms>` (ver comentario en `buildCreditNoteXml`). */
function buildNotaParties(emisor: EmisorInfo, receptor: ReceptorInfo): string {
  return `
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${emisor.ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${cdata(emisor.nombreComercial)}</cbc:Name>
      </cac:PartyName>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(emisor.razonSocial)}</cbc:RegistrationName>
        <cac:RegistrationAddress>
          <cbc:ID>${emisor.ubigeo}</cbc:ID>
          <cbc:AddressTypeCode>0000</cbc:AddressTypeCode>
          <cbc:CityName>${emisor.provincia}</cbc:CityName>
          <cbc:CountrySubentity>${emisor.departamento}</cbc:CountrySubentity>
          <cbc:District>${emisor.distrito}</cbc:District>
          <cac:AddressLine>
            <cbc:Line>${cdata(emisor.direccion)}</cbc:Line>
          </cac:AddressLine>
          <cac:Country>
            <cbc:IdentificationCode>PE</cbc:IdentificationCode>
          </cac:Country>
        </cac:RegistrationAddress>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${schemeIdReceptor(receptor.tipoDoc)}">${receptor.numeroDoc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${cdata(receptor.razonSocial)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;
}

function buildNotaTaxTotal(doc: UblNotaInput): string {
  return `
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${money(doc.igvCentimos)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${money(doc.valorVentaCentimos)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${money(doc.igvCentimos)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>`;
}

/**
 * Genera el XML UBL 2.1 `CreditNote` sin firmar (nota de crédito). Misma
 * estructura general que `buildInvoiceXml`, con tres diferencias reales de
 * SUNAT, no arbitrarias:
 * - Elemento raíz propio (`<CreditNote>`), no repite `InvoiceTypeCode` —
 *   el elemento raíz ya comunica el tipo de documento.
 * - Lleva `<cac:DiscrepancyResponse>` + `<cac:BillingReference>` enlazando
 *   con el comprobante que corrige (boleta/factura ACEPTADO).
 * - **Sin `<cac:PaymentTerms>`**: a diferencia de la factura (donde SUNAT
 *   lo exige — error 3244 si falta), en una nota SUNAT lo **rechaza** con
 *   error 3246 ("El tipo de transacción... no cumple con el formato
 *   esperado") — confirmado contra el beta real de SUNAT. Una nota no es
 *   una venta con forma de pago propia, es un ajuste sobre una que ya la
 *   tiene.
 */
export function buildCreditNoteXml(doc: UblNotaInput): string {
  const idNota = `${doc.serie}-${doc.correlativo}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent></ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${idNota}</cbc:ID>
  <cbc:IssueDate>${doc.fechaEmision}</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>${buildDiscrepancyAndReference(doc.documentoAfectado, doc.motivoCodigo, doc.motivoDescripcion)}${buildNotaSignature(idNota, doc.emisor)}${buildNotaParties(doc.emisor, doc.receptor)}${buildNotaTaxTotal(doc)}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${money(doc.valorVentaCentimos)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${money(doc.totalCentimos)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${money(doc.totalCentimos)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${doc.lineas.map((l) => buildLine(l, "CreditNoteLine", "CreditedQuantity")).join("")}
</CreditNote>`;
}

/**
 * Genera el XML UBL 2.1 `DebitNote` sin firmar (nota de débito). Mismo
 * patrón que `buildCreditNoteXml` (elemento raíz propio, DiscrepancyResponse
 * + BillingReference, sin PaymentTerms), pero el total va en
 * `<cac:RequestedMonetaryTotal>` (no `LegalMonetaryTotal`) y las líneas son
 * `<cac:DebitNoteLine>`/`<cbc:DebitedQuantity>` — nombres de elemento
 * distintos exigidos por SUNAT, mismo contenido.
 */
export function buildDebitNoteXml(doc: UblNotaInput): string {
  const idNota = `${doc.serie}-${doc.correlativo}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<DebitNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:DebitNote-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent></ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${idNota}</cbc:ID>
  <cbc:IssueDate>${doc.fechaEmision}</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>${buildDiscrepancyAndReference(doc.documentoAfectado, doc.motivoCodigo, doc.motivoDescripcion)}${buildNotaSignature(idNota, doc.emisor)}${buildNotaParties(doc.emisor, doc.receptor)}${buildNotaTaxTotal(doc)}
  <cac:RequestedMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${money(doc.valorVentaCentimos)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${money(doc.totalCentimos)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${money(doc.totalCentimos)}</cbc:PayableAmount>
  </cac:RequestedMonetaryTotal>${doc.lineas.map((l) => buildLine(l, "DebitNoteLine", "DebitedQuantity")).join("")}
</DebitNote>`;
}
