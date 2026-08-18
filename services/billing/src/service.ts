import { newId } from "@casacarlos/contracts";
import type { BajaStatus, BillingPort, Comprobante, ComunicacionBaja, DateRange, DocumentType, IssueFacturaInput, IssueNotaInput, NotaTipo, SunatStatus } from "@casacarlos/contracts";
import type { SaleWithLines, SalesPort } from "@casacarlos/contracts";
import { esMotivoNotaCreditoValido, esMotivoNotaDebitoValido } from "./domain/catalogos-notas.js";
import { desglosarIgv } from "./domain/igv.js";
import { montoEnLetras } from "./domain/monto-letras.js";
import { serieForNota, serieForTipo } from "./domain/series.js";
import { buildCreditNoteXml, buildDebitNoteXml, buildInvoiceXml, type EmisorInfo, type ReceptorInfo, type UblLineInput } from "./domain/ubl.js";
import { bajaFileName, buildVoidedDocumentsXml } from "./domain/voided.js";
import { type CertificateMaterial, signInvoiceXml } from "./domain/signature.js";
import { comprobanteFileName, zipXml } from "./domain/zip.js";
import { generateComprobantePdf } from "./domain/pdf.js";
import { BillingRepo } from "./repo.js";
import type { SunatClient, SunatSendResult } from "./sunat/types.js";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export class BillingService implements BillingPort {
  constructor(
    private readonly repo: BillingRepo,
    private readonly sales: SalesPort,
    private readonly sunatClient: SunatClient,
    private readonly emisor: EmisorInfo,
    private readonly cert: CertificateMaterial | null,
  ) {}

  async issueBoleta(ventaId: string, usuarioId: string): Promise<Comprobante> {
    const sale = await this.sales.getSale(ventaId);
    if (!sale.clienteDni) {
      throw new Error("La venta no tiene el DNI del cliente registrado — no se puede emitir una boleta.");
    }
    const receptor: ReceptorInfo = {
      tipoDoc: "DNI",
      numeroDoc: sale.clienteDni,
      razonSocial: `${sale.clienteNombres ?? ""} ${sale.clienteApellidos ?? ""}`.trim() || "CLIENTE",
    };
    return this.emit(sale, "BOLETA", receptor, usuarioId);
  }

  async issueFactura(input: IssueFacturaInput): Promise<Comprobante> {
    const sale = await this.sales.getSale(input.ventaId);
    const receptor: ReceptorInfo = { tipoDoc: "RUC", numeroDoc: input.ruc, razonSocial: input.razonSocial };
    return this.emit(sale, "FACTURA", receptor, input.usuarioId);
  }

  async getComprobante(id: string): Promise<Comprobante> {
    const comprobante = await this.repo.getComprobante(id);
    if (!comprobante) throw new Error(`Comprobante ${id} no encontrado.`);
    return comprobante;
  }

  async getForSale(ventaId: string): Promise<Comprobante | null> {
    return this.repo.getForSale(ventaId);
  }

  async listComprobantes(range?: DateRange): Promise<Comprobante[]> {
    return this.repo.listComprobantes(range);
  }

  async retrySubmission(id: string): Promise<Comprobante> {
    const existing = await this.getComprobante(id);
    if (existing.estadoSunat === "ACEPTADO") return existing;

    const xml = await this.repo.getXml(id);
    if (!xml) throw new Error(`Comprobante ${id} no tiene el XML guardado — no se puede reintentar.`);

    const fileName = comprobanteFileName(this.emisor.ruc, existing.tipo, existing.serie, existing.correlativo);
    const { result, hadException } = await this.trySend(fileName, xml);

    const updated = await this.repo.updateComprobante(id, {
      estadoSunat: this.estadoFor(result, hadException),
      sunatCodigo: result.codigo,
      sunatDescripcion: result.descripcion,
      enviadoEn: new Date().toISOString(),
    });
    if (result.cdrXml) {
      await this.repo.saveArtifacts(id, Buffer.from(xml, "utf-8").toString("base64"), Buffer.from(result.cdrXml, "utf-8").toString("base64"));
    }
    return updated;
  }

  async getXml(id: string): Promise<string | null> {
    return this.repo.getXml(id);
  }

  async getPdf(id: string): Promise<Uint8Array | null> {
    const comprobante = await this.repo.getComprobante(id);
    if (!comprobante) return null;
    return generateComprobantePdf(comprobante, this.emisor);
  }

  async voidComprobante(comprobanteId: string, motivo: string, usuarioId: string): Promise<ComunicacionBaja> {
    const existing = await this.repo.getBajaForComprobante(comprobanteId);
    if (existing) {
      if (existing.estadoSunat === "ACEPTADO") return existing;
      if (existing.estadoSunat === "PENDIENTE" && existing.ticket) return this.pollBajaStatus(existing);
      const xml = await this.repo.getBajaXml(existing.id);
      if (!xml) throw new Error(`Comunicación de baja ${existing.id} no tiene XML guardado — no se puede reintentar.`);
      return this.submitBaja(existing, xml);
    }

    const comprobante = await this.getComprobante(comprobanteId);
    if (comprobante.estadoSunat !== "ACEPTADO") {
      throw new Error("Solo se puede anular un comprobante ACEPTADO por SUNAT.");
    }
    // Confirmado contra SUNAT beta (error 2308): DocumentTypeCode "03" (boleta) no es válido
    // dentro de una Comunicación de Baja cuando la boleta se envió individualmente por sendBill
    // — SUNAT solo la admite ahí para facturas/notas. Ver docs/F5 en memoria del proyecto.
    if (comprobante.tipo !== "FACTURA") {
      throw new Error("SUNAT no admite anular una boleta emitida individualmente mediante Comunicación de Baja — solo aplica a facturas.");
    }

    const fechaReferencia = comprobante.creadoEn.slice(0, 10);
    const fechaGeneracion = new Date().toISOString().slice(0, 10);
    const correlativo = await this.repo.nextBajaCorrelativo();
    const unsignedXml = buildVoidedDocumentsXml({
      correlativo,
      fechaGeneracion,
      fechaReferencia,
      emisor: this.emisor,
      lineas: [{ tipo: comprobante.tipo, serie: comprobante.serie, correlativo: comprobante.correlativo, motivo }],
    });
    const finalXml = this.cert ? signInvoiceXml(unsignedXml, this.cert) : unsignedXml;

    const baja = await this.repo.insertBaja({
      id: newId(),
      comprobanteId,
      correlativo,
      motivo,
      ticket: null,
      estadoSunat: "PENDIENTE",
      sunatCodigo: null,
      sunatDescripcion: null,
      xmlBase64: Buffer.from(finalXml, "utf-8").toString("base64"),
      cdrBase64: null,
      usuarioId,
      creadoEn: new Date().toISOString(),
      resueltoEn: null,
    });

    return this.submitBaja(baja, finalXml);
  }

  async getBajaForComprobante(comprobanteId: string): Promise<ComunicacionBaja | null> {
    const baja = await this.repo.getBajaForComprobante(comprobanteId);
    if (baja?.estadoSunat === "PENDIENTE" && baja.ticket) {
      return this.pollBajaStatus(baja, 1, 0);
    }
    return baja;
  }

  private async submitBaja(baja: ComunicacionBaja, xml: string): Promise<ComunicacionBaja> {
    const fileName = bajaFileName(this.emisor.ruc, baja.creadoEn.slice(0, 10), baja.correlativo);
    const zipBuf = await zipXml(fileName, xml);

    let ticket: string;
    try {
      ticket = await this.sunatClient.sendSummary(`${fileName}.zip`, zipBuf);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.repo.updateBaja(baja.id, { estadoSunat: "ERROR", sunatDescripcion: message, resueltoEn: new Date().toISOString() });
    }

    const withTicket = await this.repo.updateBaja(baja.id, { ticket });
    return this.pollBajaStatus(withTicket);
  }

  /**
   * SUNAT resuelve `sendSummary` de forma asíncrona — en beta se observó que
   * puede tardar bastante más que unos segundos (a veces cerca de un
   * minuto), y una vez que `getStatus` entrega el contenido resuelto, el
   * ticket queda invalidado ("el ticket no existe" en consultas
   * posteriores) — así que solo se debe reconsultar mientras siga
   * `pendiente`. Este presupuesto (10 intentos × 4s ≈ 40s) cubre el caso
   * común sin bloquear la petición HTTP indefinidamente; si sigue
   * `PENDIENTE` al agotarse, el ticket queda guardado para el botón
   * "Revisar estado" de la UI.
   */
  private async pollBajaStatus(baja: ComunicacionBaja, attempts = 10, delayMs = 4000): Promise<ComunicacionBaja> {
    if (!baja.ticket) return baja;

    let lastError: string | null = null;
    for (let i = 0; i < attempts; i++) {
      const isLastAttempt = i === attempts - 1;
      let result;
      try {
        result = await this.sunatClient.getStatus(baja.ticket);
      } catch (err) {
        // Fallos puntuales (red, o SUNAT devolviendo un ticket que "aún no existe" justo
        // después de crearlo) no deben tumbar todo el sondeo — solo el último intento cuenta.
        lastError = err instanceof Error ? err.message : String(err);
        if (isLastAttempt) {
          return this.repo.updateBaja(baja.id, { estadoSunat: "ERROR", sunatDescripcion: lastError, resueltoEn: new Date().toISOString() });
        }
        await sleep(delayMs);
        continue;
      }

      if (result.pendiente) {
        if (!isLastAttempt) await sleep(delayMs);
        continue;
      }

      // Resuelto sin código ni CDR: SUNAT beta a veces devuelve esto mientras el ticket
      // termina de indexarse — no es un rechazo real, tratarlo como aún-pendiente.
      if (!result.aceptado && !result.codigo && !result.cdrXml) {
        lastError = result.descripcion;
        if (!isLastAttempt) {
          await sleep(delayMs);
          continue;
        }
      }

      const estadoSunat: BajaStatus = result.aceptado ? "ACEPTADO" : "RECHAZADO";
      const updated = await this.repo.updateBaja(baja.id, {
        estadoSunat,
        sunatCodigo: result.codigo,
        sunatDescripcion: result.descripcion ?? lastError,
        resueltoEn: new Date().toISOString(),
      });
      if (result.cdrXml) await this.repo.saveBajaCdr(baja.id, Buffer.from(result.cdrXml, "utf-8").toString("base64"));
      if (estadoSunat === "ACEPTADO") await this.repo.updateComprobante(baja.comprobanteId, { estadoSunat: "ANULADO" });
      return updated;
    }

    return baja;
  }

  async issueNotaCredito(comprobanteAfectadoId: string, input: IssueNotaInput, usuarioId: string): Promise<Comprobante> {
    return this.emitNota("NOTA_CREDITO", comprobanteAfectadoId, input, usuarioId);
  }

  async issueNotaDebito(comprobanteAfectadoId: string, input: IssueNotaInput, usuarioId: string): Promise<Comprobante> {
    return this.emitNota("NOTA_DEBITO", comprobanteAfectadoId, input, usuarioId);
  }

  async listNotasForComprobante(comprobanteAfectadoId: string): Promise<Comprobante[]> {
    return this.repo.listNotasForComprobante(comprobanteAfectadoId);
  }

  /**
   * A diferencia de la Comunicación de Baja (solo hasta 7 días, solo
   * factura), una nota no tiene límite de plazo y aplica tanto a boleta como
   * a factura — es el mecanismo correcto para corregir un comprobante ya
   * ACEPTADO después de esa ventana. Envío síncrono, mismo `trySend` que
   * `emit()` — sin cambiar el modelo de envío del resto del sistema.
   */
  private async emitNota(tipoNota: NotaTipo, comprobanteAfectadoId: string, input: IssueNotaInput, usuarioId: string): Promise<Comprobante> {
    const afectado = await this.getComprobante(comprobanteAfectadoId);
    if (afectado.tipo !== "BOLETA" && afectado.tipo !== "FACTURA") {
      throw new Error("Solo se puede emitir una nota contra una boleta o factura, no contra otra nota.");
    }
    if (afectado.estadoSunat !== "ACEPTADO") {
      throw new Error("Solo se puede emitir una nota contra un comprobante ACEPTADO por SUNAT.");
    }
    const motivoValido = tipoNota === "NOTA_CREDITO" ? esMotivoNotaCreditoValido(input.motivoCodigo) : esMotivoNotaDebitoValido(input.motivoCodigo);
    if (!motivoValido) {
      const catalogo = tipoNota === "NOTA_CREDITO" ? "09 (nota de crédito)" : "10 (nota de débito)";
      throw new Error(`Código de motivo "${input.motivoCodigo}" no pertenece al catálogo SUNAT ${catalogo}.`);
    }

    const tipoAfectado: DocumentType = afectado.tipo;

    const lineasConIgv: UblLineInput[] = input.lineas.map((l, idx) => {
      const { valorVentaCentimos, igvCentimos } = desglosarIgv(l.subtotalCentimos);
      return {
        id: idx + 1,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        valorVentaUnitarioCentimos: Math.round(valorVentaCentimos / l.cantidad),
        precioUnitarioCentimos: l.precioUnitarioCentimos,
        valorVentaCentimos,
        igvCentimos,
        subtotalCentimos: l.subtotalCentimos,
      };
    });
    const valorVentaCentimos = lineasConIgv.reduce((s, l) => s + l.valorVentaCentimos, 0);
    const igvCentimos = lineasConIgv.reduce((s, l) => s + l.igvCentimos, 0);
    const totalCentimos = lineasConIgv.reduce((s, l) => s + l.subtotalCentimos, 0);
    const montoLetras = montoEnLetras(totalCentimos);

    const serie = serieForNota(tipoNota, tipoAfectado);
    const correlativo = await this.repo.nextCorrelativo(serie);
    const now = new Date();

    const buildNotaXml = tipoNota === "NOTA_CREDITO" ? buildCreditNoteXml : buildDebitNoteXml;
    const unsignedXml = buildNotaXml({
      serie,
      correlativo,
      fechaEmision: now.toISOString().slice(0, 10),
      emisor: this.emisor,
      receptor: { tipoDoc: afectado.receptorTipoDoc, numeroDoc: afectado.receptorNumeroDoc, razonSocial: afectado.receptorRazonSocial },
      lineas: lineasConIgv,
      valorVentaCentimos,
      igvCentimos,
      totalCentimos,
      documentoAfectado: { tipo: tipoAfectado, serie: afectado.serie, correlativo: afectado.correlativo },
      motivoCodigo: input.motivoCodigo,
      motivoDescripcion: input.motivoDescripcion,
    });
    const finalXml = this.cert ? signInvoiceXml(unsignedXml, this.cert) : unsignedXml;

    const fileName = comprobanteFileName(this.emisor.ruc, tipoNota, serie, correlativo);
    const { result, hadException } = await this.trySend(fileName, finalXml);

    const nota = await this.repo.insertComprobante({
      id: newId(),
      ventaId: afectado.ventaId,
      tipo: tipoNota,
      serie,
      correlativo,
      receptorTipoDoc: afectado.receptorTipoDoc,
      receptorNumeroDoc: afectado.receptorNumeroDoc,
      receptorRazonSocial: afectado.receptorRazonSocial,
      lineasJson: JSON.stringify(lineasConIgv.map((l) => ({ descripcion: l.descripcion, cantidad: l.cantidad, precioUnitarioCentimos: l.precioUnitarioCentimos, subtotalCentimos: l.subtotalCentimos }))),
      valorVentaCentimos,
      igvCentimos,
      totalCentimos,
      montoLetras,
      estadoSunat: this.estadoFor(result, hadException),
      sunatCodigo: result.codigo,
      sunatDescripcion: result.descripcion,
      xmlBase64: null,
      cdrBase64: null,
      usuarioId,
      creadoEn: now.toISOString(),
      enviadoEn: now.toISOString(),
      comprobanteAfectadoId,
      motivoCodigo: input.motivoCodigo,
      motivoDescripcion: input.motivoDescripcion,
    });

    await this.repo.saveArtifacts(nota.id, Buffer.from(finalXml, "utf-8").toString("base64"), result.cdrXml ? Buffer.from(result.cdrXml, "utf-8").toString("base64") : null);

    return nota;
  }

  private async emit(sale: SaleWithLines, tipo: DocumentType, receptor: ReceptorInfo, usuarioId: string): Promise<Comprobante> {
    const activeLines = sale.lineas.filter((l) => !l.anulada);
    if (activeLines.length === 0) {
      throw new Error("La venta no tiene líneas activas — no hay nada que facturar.");
    }

    // Sin esto, reintentar por error de red o doble clic emitiría un segundo comprobante
    // legal para la misma venta — RECHAZADO/ERROR sí se puede reintentar (`retrySubmission`).
    const existing = await this.repo.getForSale(sale.id);
    if (existing?.estadoSunat === "ACEPTADO") {
      throw new Error(`Esta venta ya tiene un comprobante aceptado por SUNAT: ${existing.serie}-${existing.correlativo}.`);
    }

    const lineasConIgv: UblLineInput[] = activeLines.map((l, idx) => {
      const { valorVentaCentimos, igvCentimos } = desglosarIgv(l.subtotalCentimos);
      return {
        id: idx + 1,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        valorVentaUnitarioCentimos: Math.round(valorVentaCentimos / l.cantidad),
        precioUnitarioCentimos: l.precioUnitarioCentimos,
        valorVentaCentimos,
        igvCentimos,
        subtotalCentimos: l.subtotalCentimos,
      };
    });

    const valorVentaCentimos = lineasConIgv.reduce((s, l) => s + l.valorVentaCentimos, 0);
    const igvCentimos = lineasConIgv.reduce((s, l) => s + l.igvCentimos, 0);
    const totalCentimos = lineasConIgv.reduce((s, l) => s + l.subtotalCentimos, 0);
    const montoLetras = montoEnLetras(totalCentimos);

    const serie = serieForTipo(tipo);
    const correlativo = await this.repo.nextCorrelativo(serie);
    const now = new Date();

    const unsignedXml = buildInvoiceXml({
      tipo,
      serie,
      correlativo,
      fechaEmision: now.toISOString().slice(0, 10),
      horaEmision: now.toISOString().slice(11, 19),
      emisor: this.emisor,
      receptor,
      lineas: lineasConIgv,
      valorVentaCentimos,
      igvCentimos,
      totalCentimos,
      montoLetras,
    });
    const finalXml = this.cert ? signInvoiceXml(unsignedXml, this.cert) : unsignedXml;

    const fileName = comprobanteFileName(this.emisor.ruc, tipo, serie, correlativo);
    const { result, hadException } = await this.trySend(fileName, finalXml);

    const comprobante = await this.repo.insertComprobante({
      id: newId(),
      ventaId: sale.id,
      tipo,
      serie,
      correlativo,
      receptorTipoDoc: receptor.tipoDoc,
      receptorNumeroDoc: receptor.numeroDoc,
      receptorRazonSocial: receptor.razonSocial,
      lineasJson: JSON.stringify(lineasConIgv.map((l) => ({ descripcion: l.descripcion, cantidad: l.cantidad, precioUnitarioCentimos: l.precioUnitarioCentimos, subtotalCentimos: l.subtotalCentimos }))),
      valorVentaCentimos,
      igvCentimos,
      totalCentimos,
      montoLetras,
      estadoSunat: this.estadoFor(result, hadException),
      sunatCodigo: result.codigo,
      sunatDescripcion: result.descripcion,
      xmlBase64: null,
      cdrBase64: null,
      usuarioId,
      creadoEn: now.toISOString(),
      enviadoEn: now.toISOString(),
      comprobanteAfectadoId: null,
      motivoCodigo: null,
      motivoDescripcion: null,
    });

    await this.repo.saveArtifacts(comprobante.id, Buffer.from(finalXml, "utf-8").toString("base64"), result.cdrXml ? Buffer.from(result.cdrXml, "utf-8").toString("base64") : null);

    return comprobante;
  }

  private async trySend(fileName: string, xml: string): Promise<{ result: SunatSendResult; hadException: boolean }> {
    const zipBuf = await zipXml(fileName, xml);
    try {
      const result = await this.sunatClient.sendBill(`${fileName}.zip`, zipBuf);
      return { result, hadException: false };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { result: { aceptado: false, codigo: null, descripcion: message, cdrXml: null }, hadException: true };
    }
  }

  private estadoFor(result: SunatSendResult, hadException: boolean): SunatStatus {
    if (result.aceptado) return "ACEPTADO";
    return hadException ? "ERROR" : "RECHAZADO";
  }
}
