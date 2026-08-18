export interface SunatSendResult {
  aceptado: boolean;
  codigo: string | null;
  descripcion: string | null;
  /** XML de la Constancia de Recepción (CDR) ya descomprimido, si SUNAT la devolvió. */
  cdrXml: string | null;
}

/** Resultado de consultar un ticket de `sendSummary` (envío asíncrono) vía `getStatus`. */
export interface SunatTicketResult {
  /** `true` mientras SUNAT sigue procesando (statusCode 98) — hay que volver a preguntar más tarde. */
  pendiente: boolean;
  aceptado: boolean;
  codigo: string | null;
  descripcion: string | null;
  cdrXml: string | null;
}

export interface SunatClient {
  sendBill(fileName: string, zipBuffer: Buffer): Promise<SunatSendResult>;
  /** Envío asíncrono (Comunicación de Baja, resúmenes diarios) — devuelve un ticket para consultar con `getStatus`. */
  sendSummary(fileName: string, zipBuffer: Buffer): Promise<string>;
  getStatus(ticket: string): Promise<SunatTicketResult>;
}
