import { asc, eq } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";
import type { CollectionAccount, Payment, PaymentDetail } from "@casacarlos/contracts";

type PaymentRow = typeof schema.paymentsPagos.$inferSelect;
type DetailRow = typeof schema.paymentsDetalles.$inferSelect;
type CollectionAccountRow = typeof schema.paymentsCuentasCobro.$inferSelect;

const toCollectionAccount = (r: CollectionAccountRow): CollectionAccount => ({
  id: r.id,
  tipo: r.tipo,
  metodo: r.metodo,
  proveedor: r.proveedor,
  titular: r.titular,
  telefono: r.telefono,
  numeroCuenta: r.numeroCuenta,
  cci: r.cci,
  notas: r.notas,
  qrArchivo: r.qrArchivo,
  qrUrl: r.qrArchivo ? `/qr-images/${encodeURIComponent(r.qrArchivo)}` : null,
  orden: r.orden,
  activa: r.activa,
});

const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  ventaId: r.ventaId,
  totalCentimos: r.totalCentimos,
  estado: r.estado,
  motivoRechazo: r.motivoRechazo,
  aceptadoPor: r.aceptadoPor,
  aceptadoEn: r.aceptadoEn,
  creadoEn: r.creadoEn,
});

const toDetail = (r: DetailRow): PaymentDetail => ({
  id: r.id,
  pagoId: r.pagoId,
  metodo: r.metodo,
  montoCentimos: r.montoCentimos,
  codigoOperacion: r.codigoOperacion,
  ordenanteNombres: r.ordenanteNombres,
  ordenanteApellidos: r.ordenanteApellidos,
  bancoOrigen: r.bancoOrigen,
  recibidoCentimos: r.recibidoCentimos,
  vueltoCentimos: r.vueltoCentimos,
  creadoEn: r.creadoEn,
});

export class PaymentsRepo {
  constructor(private readonly db: Db) {}

  async insertPayment(row: PaymentRow): Promise<Payment> {
    await this.db.insert(schema.paymentsPagos).values(row);
    return toPayment(row);
  }

  async getPayment(id: string): Promise<Payment | null> {
    const row = await this.db.select().from(schema.paymentsPagos).where(eq(schema.paymentsPagos.id, id)).get();
    return row ? toPayment(row) : null;
  }

  async updatePayment(id: string, patch: Partial<PaymentRow>): Promise<Payment> {
    await this.db.update(schema.paymentsPagos).set(patch).where(eq(schema.paymentsPagos.id, id));
    const updated = await this.getPayment(id);
    if (!updated) throw new Error(`Pago ${id} no encontrado tras actualizar.`);
    return updated;
  }

  async insertDetail(row: DetailRow): Promise<PaymentDetail> {
    await this.db.insert(schema.paymentsDetalles).values(row);
    return toDetail(row);
  }

  async listDetails(pagoId: string): Promise<PaymentDetail[]> {
    const rows = await this.db.select().from(schema.paymentsDetalles).where(eq(schema.paymentsDetalles.pagoId, pagoId)).all();
    return rows.map(toDetail);
  }

  async listForSale(ventaId: string): Promise<Payment[]> {
    const rows = await this.db.select().from(schema.paymentsPagos).where(eq(schema.paymentsPagos.ventaId, ventaId)).all();
    return rows.map(toPayment);
  }

  async insertCollectionAccount(row: CollectionAccountRow): Promise<CollectionAccount> {
    await this.db.insert(schema.paymentsCuentasCobro).values(row);
    return toCollectionAccount(row);
  }

  async listCollectionAccounts(soloActivas: boolean): Promise<CollectionAccount[]> {
    const rows = soloActivas
      ? await this.db
          .select()
          .from(schema.paymentsCuentasCobro)
          .where(eq(schema.paymentsCuentasCobro.activa, true))
          .orderBy(asc(schema.paymentsCuentasCobro.orden))
          .all()
      : await this.db.select().from(schema.paymentsCuentasCobro).orderBy(asc(schema.paymentsCuentasCobro.orden)).all();
    return rows.map(toCollectionAccount);
  }

  async getCollectionAccount(id: string): Promise<CollectionAccount | null> {
    const row = await this.db.select().from(schema.paymentsCuentasCobro).where(eq(schema.paymentsCuentasCobro.id, id)).get();
    return row ? toCollectionAccount(row) : null;
  }

  async updateCollectionAccount(id: string, patch: Partial<CollectionAccountRow>): Promise<CollectionAccount> {
    await this.db.update(schema.paymentsCuentasCobro).set(patch).where(eq(schema.paymentsCuentasCobro.id, id));
    const updated = await this.getCollectionAccount(id);
    if (!updated) throw new Error(`Canal de cobro ${id} no encontrado.`);
    return updated;
  }

  async deleteCollectionAccount(id: string): Promise<void> {
    await this.db.delete(schema.paymentsCuentasCobro).where(eq(schema.paymentsCuentasCobro.id, id));
  }
}
