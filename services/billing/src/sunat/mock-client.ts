import type { SunatClient, SunatSendResult, SunatTicketResult } from "./types.js";

/**
 * Adaptador por defecto: simula una aceptación inmediata, sin red y sin
 * certificado — para desarrollo y demo sin necesidad de credenciales
 * SUNAT. Igual que `ConsoleSender` en `services/notifications`.
 */
export class MockSunatClient implements SunatClient {
  async sendBill(): Promise<SunatSendResult> {
    return { aceptado: true, codigo: "0", descripcion: "The Bill was accepted (simulado — SUNAT no fue contactado)", cdrXml: null };
  }

  async sendSummary(): Promise<string> {
    return `mock-ticket-${Date.now()}`;
  }

  async getStatus(): Promise<SunatTicketResult> {
    return { pendiente: false, aceptado: true, codigo: "0", descripcion: "The Summary was accepted (simulado — SUNAT no fue contactado)", cdrXml: null };
  }
}
