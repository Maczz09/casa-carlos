import type { Db } from "@casacarlos/db";
import { recordAudit } from "@casacarlos/db";
import { newId } from "@casacarlos/contracts";
import type {
  CollectionAccount,
  CreateCollectionAccountInput,
  CreatePaymentInput,
  Payment,
  PaymentsPort,
  PaymentWithDetails,
  SalesPort,
} from "@casacarlos/contracts";
import { cents, sumEquals } from "@casacarlos/money";
import type { EventBus } from "@casacarlos/bus";
import { PaymentsRepo } from "./repo.js";

export class PaymentsService implements PaymentsPort {
  private readonly repo: PaymentsRepo;

  constructor(
    private readonly db: Db,
    private readonly bus: EventBus,
    private readonly sales: SalesPort,
  ) {
    this.repo = new PaymentsRepo(db);
  }

  async create(input: CreatePaymentInput): Promise<PaymentWithDetails> {
    if (input.detalles.length === 0) {
      throw new Error("Un pago necesita al menos un método de pago.");
    }
    const sale = await this.sales.getSale(input.saleId);
    const amounts = input.detalles.map((d) => cents(d.montoCentimos));
    if (!sumEquals(amounts, cents(sale.saldoCentimos))) {
      throw new Error(
        `La suma de los métodos de pago no coincide con el saldo a cobrar (saldo: ${sale.saldoCentimos}, suma ingresada: ${amounts.reduce((a, b) => a + b, 0)}).`,
      );
    }

    const now = new Date().toISOString();
    const payment = await this.repo.insertPayment({
      id: newId(),
      ventaId: input.saleId,
      totalCentimos: sale.saldoCentimos,
      estado: "PENDIENTE",
      motivoRechazo: null,
      aceptadoPor: null,
      aceptadoEn: null,
      creadoEn: now,
    });

    for (const detalle of input.detalles) {
      const recibido = detalle.recibidoCentimos ?? null;
      const vuelto = detalle.metodo === "EFECTIVO" && recibido !== null ? Math.max(0, recibido - detalle.montoCentimos) : null;
      await this.repo.insertDetail({
        id: newId(),
        pagoId: payment.id,
        metodo: detalle.metodo,
        montoCentimos: detalle.montoCentimos,
        codigoOperacion: detalle.codigoOperacion ?? null,
        ordenanteNombres: detalle.ordenanteNombres ?? null,
        ordenanteApellidos: detalle.ordenanteApellidos ?? null,
        bancoOrigen: detalle.bancoOrigen ?? null,
        recibidoCentimos: recibido,
        vueltoCentimos: vuelto,
        creadoEn: now,
      });
    }

    await recordAudit(this.db, { entidad: "payments_pagos", entidadId: payment.id, accion: "CREAR", despues: payment });
    return this.getPayment(payment.id);
  }

  async accept(paymentId: string, usuarioId: string): Promise<PaymentWithDetails> {
    const payment = await this.mustGet(paymentId);
    if (payment.estado !== "PENDIENTE") throw new Error(`El pago ${paymentId} ya fue resuelto (${payment.estado}).`);
    const now = new Date().toISOString();
    const updated = await this.repo.updatePayment(paymentId, { estado: "ACEPTADO", aceptadoPor: usuarioId, aceptadoEn: now });
    await recordAudit(this.db, { entidad: "payments_pagos", entidadId: paymentId, accion: "ACEPTAR", usuarioId, antes: payment, despues: updated });
    await this.bus.publish("payment.accepted", { paymentId, saleId: updated.ventaId, totalCentimos: updated.totalCentimos, aceptadoPor: usuarioId });
    return this.getPayment(paymentId);
  }

  async reject(paymentId: string, motivo: string, usuarioId: string): Promise<PaymentWithDetails> {
    const payment = await this.mustGet(paymentId);
    if (payment.estado !== "PENDIENTE") throw new Error(`El pago ${paymentId} ya fue resuelto (${payment.estado}).`);
    const updated = await this.repo.updatePayment(paymentId, { estado: "RECHAZADO", motivoRechazo: motivo });
    await recordAudit(this.db, { entidad: "payments_pagos", entidadId: paymentId, accion: "RECHAZAR", usuarioId, antes: payment, despues: updated, motivo });
    await this.bus.publish("payment.rejected", { paymentId, saleId: updated.ventaId, motivo });
    return this.getPayment(paymentId);
  }

  async getPayment(id: string): Promise<PaymentWithDetails> {
    const payment = await this.mustGet(id);
    return { ...payment, detalles: await this.repo.listDetails(id) };
  }

  async getForSale(saleId: string): Promise<PaymentWithDetails[]> {
    const payments = await this.repo.listForSale(saleId);
    return Promise.all(payments.map(async (p) => ({ ...p, detalles: await this.repo.listDetails(p.id) })));
  }

  async createCollectionAccount(input: CreateCollectionAccountInput): Promise<CollectionAccount> {
    return this.repo.insertCollectionAccount({
      id: newId(),
      tipo: input.tipo,
      proveedor: input.proveedor,
      titular: input.titular,
      numeroCuenta: input.numeroCuenta ?? null,
      cci: input.cci ?? null,
      qrImagenUrl: input.qrImagenUrl ?? null,
      orden: input.orden ?? 0,
      activa: true,
    });
  }

  async listCollectionAccounts(): Promise<CollectionAccount[]> {
    return this.repo.listCollectionAccounts();
  }

  private async mustGet(id: string): Promise<Payment> {
    const payment = await this.repo.getPayment(id);
    if (!payment) throw new Error(`Pago ${id} no encontrado.`);
    return payment;
  }
}
