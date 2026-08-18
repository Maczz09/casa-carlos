import { XMLParser } from "fast-xml-parser";
import { unzipSingleXml } from "../domain/zip.js";
import type { SunatClient, SunatSendResult, SunatTicketResult } from "./types.js";

export interface RealSunatClientConfig {
  /** URL del billService SIN `?wsdl` — ej. `https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService`. */
  endpoint: string;
  ruc: string;
  solUser: string;
  solPassword: string;
}

const SOAP_NS = "http://schemas.xmlsoap.org/soap/envelope/";
const WSSE_NS = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";
const SUNAT_NS = "http://service.sunat.gob.pe";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface SoapFault {
  codigo: string | null;
  mensaje: string;
}

/**
 * Cliente SOAP construido a mano contra `billService` de SUNAT (SEE - Del
 * Contribuyente) — sin PSE/OSE intermediario, usando el certificado digital
 * propio (decisión del cliente). No se usó el paquete `soap` de npm: la
 * superficie real que se necesita son tres métodos (`sendBill`,
 * `sendSummary`, `getStatus`), así que un sobre SOAP + cabecera
 * WS-Security a mano es más simple y transparente que cargar una librería
 * que hace introspección de WSDL.
 */
export class RealSunatClient implements SunatClient {
  constructor(private readonly config: RealSunatClientConfig) {}

  async sendBill(fileName: string, zipBuffer: Buffer): Promise<SunatSendResult> {
    const parsed = await this.call(
      "sendBill",
      `<ser:sendBill><fileName>${escapeXml(fileName)}</fileName><contentFile>${zipBuffer.toString("base64")}</contentFile></ser:sendBill>`,
    );

    const fault = this.extractFault(parsed);
    if (fault) return { aceptado: false, codigo: fault.codigo, descripcion: fault.mensaje, cdrXml: null };

    const base64Cdr = parsed?.Envelope?.Body?.sendBillResponse?.applicationResponse;
    if (!base64Cdr) {
      return { aceptado: false, codigo: null, descripcion: "Respuesta de SUNAT sin CDR ni fault reconocible.", cdrXml: null };
    }
    const unzipped = await unzipSingleXml(Buffer.from(String(base64Cdr), "base64"));
    if (!unzipped) return { aceptado: false, codigo: null, descripcion: "No se pudo descomprimir el CDR recibido de SUNAT.", cdrXml: null };

    const { codigo, descripcion } = this.readCdrResponse(unzipped.xml);
    return { aceptado: codigo === "0", codigo, descripcion, cdrXml: unzipped.xml };
  }

  async sendSummary(fileName: string, zipBuffer: Buffer): Promise<string> {
    const parsed = await this.call(
      "sendSummary",
      `<ser:sendSummary><fileName>${escapeXml(fileName)}</fileName><contentFile>${zipBuffer.toString("base64")}</contentFile></ser:sendSummary>`,
    );

    const fault = this.extractFault(parsed);
    if (fault) throw new Error(`SUNAT rechazó el envío: ${fault.mensaje}`);

    const ticket = parsed?.Envelope?.Body?.sendSummaryResponse?.ticket;
    if (!ticket) throw new Error("SUNAT no devolvió un ticket para este envío.");
    return String(ticket);
  }

  async getStatus(ticket: string): Promise<SunatTicketResult> {
    const parsed = await this.call("getStatus", `<ser:getStatus><ticket>${escapeXml(ticket)}</ticket></ser:getStatus>`);

    const fault = this.extractFault(parsed);
    if (fault) return { pendiente: false, aceptado: false, codigo: fault.codigo, descripcion: fault.mensaje, cdrXml: null };

    const status = parsed?.Envelope?.Body?.getStatusResponse?.status;
    const statusCode = status?.statusCode !== undefined ? String(status.statusCode) : null;
    if (statusCode === "98") {
      return { pendiente: true, aceptado: false, codigo: statusCode, descripcion: "SUNAT sigue procesando el envío.", cdrXml: null };
    }

    const content = status?.content;
    if (!content) {
      return { pendiente: false, aceptado: false, codigo: statusCode, descripcion: "Respuesta de SUNAT sin contenido reconocible.", cdrXml: null };
    }
    const unzipped = await unzipSingleXml(Buffer.from(String(content), "base64"));
    if (!unzipped) return { pendiente: false, aceptado: false, codigo: statusCode, descripcion: "No se pudo descomprimir la respuesta de SUNAT.", cdrXml: null };

    const { codigo, descripcion } = this.readCdrResponse(unzipped.xml);
    return { pendiente: false, aceptado: codigo === "0", codigo, descripcion, cdrXml: unzipped.xml };
  }

  private async call(operation: "sendBill" | "sendSummary" | "getStatus", bodyXml: string): Promise<any> {
    const username = `${this.config.ruc}${this.config.solUser}`;
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="${SOAP_NS}" xmlns:wsse="${WSSE_NS}" xmlns:ser="${SUNAT_NS}">
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${escapeXml(username)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml(this.config.solPassword)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>${bodyXml}</soapenv:Body>
</soapenv:Envelope>`;

    const httpResponse = await fetch(this.config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/xml;charset=UTF-8", SOAPAction: `urn:${operation}` },
      body: envelope,
    });
    const responseText = await httpResponse.text();
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    return parser.parse(responseText);
  }

  private extractFault(parsed: any): SoapFault | null {
    const fault = parsed?.Envelope?.Body?.Fault;
    if (!fault) return null;
    const codigo = fault.faultcode ? String(fault.faultcode) : null;
    let mensaje = fault.faultstring ? String(fault.faultstring) : "SUNAT rechazó la solicitud.";
    if (fault.detail) mensaje = `${mensaje} (${typeof fault.detail === "string" ? fault.detail : JSON.stringify(fault.detail)})`;
    return { codigo, mensaje };
  }

  private readCdrResponse(cdrXml: string): { codigo: string | null; descripcion: string | null } {
    const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true });
    const cdrParsed = parser.parse(cdrXml);
    const response = cdrParsed?.ApplicationResponse?.DocumentResponse?.Response;
    const codigo = response?.ResponseCode !== undefined ? String(response.ResponseCode) : null;
    const descripcion = response?.Description !== undefined ? String(response.Description) : null;
    return { codigo, descripcion };
  }
}
