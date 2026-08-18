import type { Comprobante, ComunicacionBaja, IssueNotaInput } from "../entities/billing.js";
import type { DateRange } from "../entities/common.js";

export interface IssueFacturaInput {
  ventaId: string;
  ruc: string;
  razonSocial: string;
  usuarioId: string;
}

/**
 * Public surface of `billing`. Emits electrónico comprobantes (boleta/factura)
 * for a closed sale and submits them to SUNAT — directly, using the free
 * MYPE digital certificate, no PSE/OSE intermediary (decisión del cliente).
 */
export interface BillingPort {
  /** Usa el DNI/nombre ya registrados en la venta — no requiere datos adicionales. */
  issueBoleta(ventaId: string, usuarioId: string): Promise<Comprobante>;
  /** El RUC/razón social del receptor se piden aparte: quien paga no siempre es el huésped registrado. */
  issueFactura(input: IssueFacturaInput): Promise<Comprobante>;

  getComprobante(id: string): Promise<Comprobante>;
  getForSale(ventaId: string): Promise<Comprobante | null>;
  listComprobantes(range?: DateRange): Promise<Comprobante[]>;
  /** El XML firmado tal como se envió a SUNAT — para descarga/auditoría. `null` si el comprobante no existe. */
  getXml(id: string): Promise<string | null>;
  /** PDF de cortesía con QR — el documento legal sigue siendo el XML firmado, no este PDF. `null` si el comprobante no existe. */
  getPdf(id: string): Promise<Uint8Array | null>;

  /** Reintenta el envío a SUNAT de un comprobante en RECHAZADO o ERROR. */
  retrySubmission(id: string): Promise<Comprobante>;

  /**
   * Envía una Comunicación de Baja para anular un comprobante ACEPTADO
   * (SUNAT solo la admite hasta 7 días calendario después de la aceptación —
   * pasado ese plazo, rechaza y hace falta una Nota de Crédito en su lugar,
   * ver `issueNotaCredito`). El envío es asíncrono: si ya existe una baja
   * PENDIENTE para este comprobante, esta llamada solo reconsulta su estado
   * en vez de reenviarla.
   */
  voidComprobante(comprobanteId: string, motivo: string, usuarioId: string): Promise<ComunicacionBaja>;
  getBajaForComprobante(comprobanteId: string): Promise<ComunicacionBaja | null>;

  /**
   * Emite una nota de crédito/débito contra un comprobante ya ACEPTADO —
   * a diferencia de la Comunicación de Baja, no tiene límite de 7 días y es
   * el mecanismo correcto para corregir un comprobante después de ese plazo
   * (descuento, devolución, error). El envío a SUNAT es síncrono, igual que
   * `issueBoleta`/`issueFactura`.
   */
  issueNotaCredito(comprobanteAfectadoId: string, input: IssueNotaInput, usuarioId: string): Promise<Comprobante>;
  issueNotaDebito(comprobanteAfectadoId: string, input: IssueNotaInput, usuarioId: string): Promise<Comprobante>;
  /** Notas ya emitidas contra un comprobante — para mostrarlas junto al comprobante en la UI. */
  listNotasForComprobante(comprobanteAfectadoId: string): Promise<Comprobante[]>;
}
