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

function buildLine(l: UblLineInput): string {
  return `
  <cac:InvoiceLine>
    <cbc:ID>${l.id}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="NIU">${l.cantidad}</cbc:InvoicedQuantity>
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
  </cac:InvoiceLine>`;
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
  </cac:LegalMonetaryTotal>${doc.lineas.map(buildLine).join("")}
</Invoice>`;
}
