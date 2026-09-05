import type { Db } from "@casacarlos/db";
import { recordAudit } from "@casacarlos/db";
import { WALLET_PROVIDERS, newId } from "@casacarlos/contracts";
import type {
  CollectionAccount,
  CollectionAccountQrInput,
  CreateCollectionAccountInput,
  CreatePaymentInput,
  Payment,
  PaymentMethod,
  PaymentsPort,
  PaymentWithDetails,
  SalesPort,
  UpdateCollectionAccountInput,
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

  async createCollectionAccount(input: CreateCollectionAccountInput, usuarioId: string): Promise<CollectionAccount> {
    const proveedor = input.proveedor.trim();
    const titular = input.titular.trim();
    if (proveedor.length === 0) throw new Error(input.tipo === "BANCO" ? "Indica el banco." : "Indica la billetera.");
    if (titular.length === 0) throw new Error("Indica a nombre de quién está la cuenta.");

    const cuenta = await this.repo.insertCollectionAccount({
      id: newId(),
      tipo: input.tipo,
      metodo: metodoDe(input.tipo, proveedor),
      proveedor: input.tipo === "BILLETERA" ? proveedor.toUpperCase() : proveedor,
      titular,
      telefono: blankToNull(input.telefono),
      numeroCuenta: blankToNull(input.numeroCuenta),
      cci: blankToNull(input.cci),
      notas: blankToNull(input.notas),
      qrArchivo: null,
      qrMimeType: null,
      orden: input.orden ?? 0,
      activa: true,
    });
    // Por dónde entra la plata del hotel queda en la bitácora igual que los
    // cambios de producto o de tarifa: es un dato que conviene poder rastrear.
    await recordAudit(this.db, { entidad: "payments_cuentas_cobro", entidadId: cuenta.id, accion: "CREAR", usuarioId, despues: cuenta });
    return cuenta;
  }

  async updateCollectionAccount(id: string, input: UpdateCollectionAccountInput, usuarioId: string): Promise<CollectionAccount> {
    const actual = await this.mustGetAccount(id);
    const patch: Record<string, unknown> = {};

    if (input.proveedor !== undefined) {
      const proveedor = input.proveedor.trim();
      if (proveedor.length === 0) throw new Error(actual.tipo === "BANCO" ? "Indica el banco." : "Indica la billetera.");
      patch["proveedor"] = actual.tipo === "BILLETERA" ? proveedor.toUpperCase() : proveedor;
      // El método sigue al proveedor: cambiar la billetera de Yape a Plin
      // cambia también con qué método se registra lo que entre por ese canal.
      patch["metodo"] = metodoDe(actual.tipo, proveedor);
    }
    if (input.titular !== undefined) {
      const titular = input.titular.trim();
      if (titular.length === 0) throw new Error("Indica a nombre de quién está la cuenta.");
      patch["titular"] = titular;
    }
    if (input.telefono !== undefined) patch["telefono"] = blankToNull(input.telefono);
    if (input.numeroCuenta !== undefined) patch["numeroCuenta"] = blankToNull(input.numeroCuenta);
    if (input.cci !== undefined) patch["cci"] = blankToNull(input.cci);
    if (input.notas !== undefined) patch["notas"] = blankToNull(input.notas);
    if (input.orden !== undefined) patch["orden"] = input.orden;
    if (input.activa !== undefined) patch["activa"] = input.activa;

    const cuenta = await this.repo.updateCollectionAccount(id, patch);
    await recordAudit(this.db, { entidad: "payments_cuentas_cobro", entidadId: id, accion: "ACTUALIZAR", usuarioId, antes: actual, despues: cuenta });
    return cuenta;
  }

  async deleteCollectionAccount(id: string, usuarioId: string): Promise<CollectionAccount> {
    const cuenta = await this.mustGetAccount(id);
    await this.repo.deleteCollectionAccount(id);
    await recordAudit(this.db, { entidad: "payments_cuentas_cobro", entidadId: id, accion: "ELIMINAR", usuarioId, antes: cuenta });
    return cuenta;
  }

  async setCollectionAccountQr(
    id: string,
    qr: CollectionAccountQrInput,
    usuarioId: string,
  ): Promise<{ cuenta: CollectionAccount; archivoAnterior: string | null }> {
    const actual = await this.mustGetAccount(id);
    const cuenta = await this.repo.updateCollectionAccount(id, { qrArchivo: qr.archivo, qrMimeType: qr.mimeType });
    await recordAudit(this.db, { entidad: "payments_cuentas_cobro", entidadId: id, accion: "CARGAR_QR", usuarioId, antes: actual, despues: cuenta });
    return { cuenta, archivoAnterior: actual.qrArchivo };
  }

  async clearCollectionAccountQr(id: string, usuarioId: string): Promise<{ cuenta: CollectionAccount; archivoAnterior: string | null }> {
    const actual = await this.mustGetAccount(id);
    const cuenta = await this.repo.updateCollectionAccount(id, { qrArchivo: null, qrMimeType: null });
    await recordAudit(this.db, { entidad: "payments_cuentas_cobro", entidadId: id, accion: "QUITAR_QR", usuarioId, antes: actual, despues: cuenta });
    return { cuenta, archivoAnterior: actual.qrArchivo };
  }

  async listCollectionAccounts(): Promise<CollectionAccount[]> {
    return this.repo.listCollectionAccounts(true);
  }

  async listAllCollectionAccounts(): Promise<CollectionAccount[]> {
    return this.repo.listCollectionAccounts(false);
  }

  private async mustGetAccount(id: string): Promise<CollectionAccount> {
    const cuenta = await this.repo.getCollectionAccount(id);
    if (!cuenta) throw new Error("Ese canal de cobro ya no existe.");
    return cuenta;
  }

  private async mustGet(id: string): Promise<Payment> {
    const payment = await this.repo.getPayment(id);
    if (!payment) throw new Error(`Pago ${id} no encontrado.`);
    return payment;
  }
}

const blankToNull = (value: string | null | undefined): string | null => {
  const limpio = value?.trim();
  return limpio ? limpio : null;
};

/**
 * Con qué `PaymentMethod` se registra lo que entra por un canal. Una billetera
 * cobra con su propio método y por eso su proveedor no es texto libre; un banco
 * siempre cobra como TRANSFERENCIA, y ahí el proveedor sí es libre — el hotel
 * puede tener cuentas en cualquier banco o caja municipal.
 */
function metodoDe(tipo: "BANCO" | "BILLETERA", proveedor: string): PaymentMethod {
  if (tipo === "BANCO") return "TRANSFERENCIA";
  const normalizado = proveedor.trim().toUpperCase();
  const billetera = WALLET_PROVIDERS.find((w) => w === normalizado);
  if (!billetera) {
    throw new Error(`Billetera no reconocida: ${proveedor}. Las disponibles son ${WALLET_PROVIDERS.join(", ")}.`);
  }
  return billetera;
}
