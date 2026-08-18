import { and, eq, gte, lte } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";
import type { Comprobante, ComprobanteLine, ComunicacionBaja } from "@casacarlos/contracts";

type ComprobanteRow = typeof schema.billingComprobantes.$inferSelect;
type BajaRow = typeof schema.billingBajas.$inferSelect;

const toComprobante = (r: ComprobanteRow): Comprobante => ({
  id: r.id,
  ventaId: r.ventaId,
  tipo: r.tipo,
  serie: r.serie,
  correlativo: r.correlativo,
  receptorTipoDoc: r.receptorTipoDoc,
  receptorNumeroDoc: r.receptorNumeroDoc,
  receptorRazonSocial: r.receptorRazonSocial,
  lineas: JSON.parse(r.lineasJson) as ComprobanteLine[],
  valorVentaCentimos: r.valorVentaCentimos,
  igvCentimos: r.igvCentimos,
  totalCentimos: r.totalCentimos,
  montoLetras: r.montoLetras,
  estadoSunat: r.estadoSunat,
  sunatCodigo: r.sunatCodigo,
  sunatDescripcion: r.sunatDescripcion,
  usuarioId: r.usuarioId,
  creadoEn: r.creadoEn,
  enviadoEn: r.enviadoEn,
});

const toBaja = (r: BajaRow): ComunicacionBaja => ({
  id: r.id,
  comprobanteId: r.comprobanteId,
  correlativo: r.correlativo,
  motivo: r.motivo,
  ticket: r.ticket,
  estadoSunat: r.estadoSunat,
  sunatCodigo: r.sunatCodigo,
  sunatDescripcion: r.sunatDescripcion,
  usuarioId: r.usuarioId,
  creadoEn: r.creadoEn,
  resueltoEn: r.resueltoEn,
});

export class BillingRepo {
  constructor(private readonly db: Db) {}

  /** Igual patrón que `services/sales`: MAX(correlativo)+1 sobre las filas existentes — suficiente en un proceso SQLite de un solo escritor. */
  async nextCorrelativo(serie: string): Promise<number> {
    const rows = await this.db.select({ correlativo: schema.billingComprobantes.correlativo }).from(schema.billingComprobantes).where(eq(schema.billingComprobantes.serie, serie)).all();
    return rows.reduce((max, r) => Math.max(max, r.correlativo), 0) + 1;
  }

  async insertComprobante(row: ComprobanteRow): Promise<Comprobante> {
    await this.db.insert(schema.billingComprobantes).values(row);
    return toComprobante(row);
  }

  async getComprobante(id: string): Promise<Comprobante | null> {
    const row = await this.db.select().from(schema.billingComprobantes).where(eq(schema.billingComprobantes.id, id)).get();
    return row ? toComprobante(row) : null;
  }

  async getForSale(ventaId: string): Promise<Comprobante | null> {
    const row = await this.db.select().from(schema.billingComprobantes).where(eq(schema.billingComprobantes.ventaId, ventaId)).get();
    return row ? toComprobante(row) : null;
  }

  async listComprobantes(range?: { desde: string; hasta: string }): Promise<Comprobante[]> {
    const rows = range
      ? await this.db
          .select()
          .from(schema.billingComprobantes)
          .where(and(gte(schema.billingComprobantes.creadoEn, `${range.desde}T00:00:00.000Z`), lte(schema.billingComprobantes.creadoEn, `${range.hasta}T23:59:59.999Z`)))
          .all()
      : await this.db.select().from(schema.billingComprobantes).all();
    return rows.map(toComprobante).sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  }

  async updateComprobante(id: string, patch: Partial<ComprobanteRow>): Promise<Comprobante> {
    await this.db.update(schema.billingComprobantes).set(patch).where(eq(schema.billingComprobantes.id, id));
    const updated = await this.getComprobante(id);
    if (!updated) throw new Error(`Comprobante ${id} no encontrado tras actualizar.`);
    return updated;
  }

  /** Guarda el XML firmado y el CDR aparte — no viajan en el objeto `Comprobante` del contrato (solo para auditoría/reimpresión). */
  async saveArtifacts(id: string, xmlBase64: string, cdrBase64: string | null): Promise<void> {
    await this.db.update(schema.billingComprobantes).set({ xmlBase64, cdrBase64 }).where(eq(schema.billingComprobantes.id, id));
  }

  async getXml(id: string): Promise<string | null> {
    const row = await this.db.select({ xmlBase64: schema.billingComprobantes.xmlBase64 }).from(schema.billingComprobantes).where(eq(schema.billingComprobantes.id, id)).get();
    if (!row?.xmlBase64) return null;
    return Buffer.from(row.xmlBase64, "base64").toString("utf-8");
  }

  async nextBajaCorrelativo(): Promise<number> {
    const rows = await this.db.select({ correlativo: schema.billingBajas.correlativo }).from(schema.billingBajas).all();
    return rows.reduce((max, r) => Math.max(max, r.correlativo), 0) + 1;
  }

  async insertBaja(row: BajaRow): Promise<ComunicacionBaja> {
    await this.db.insert(schema.billingBajas).values(row);
    return toBaja(row);
  }

  async getBajaForComprobante(comprobanteId: string): Promise<ComunicacionBaja | null> {
    const row = await this.db.select().from(schema.billingBajas).where(eq(schema.billingBajas.comprobanteId, comprobanteId)).get();
    return row ? toBaja(row) : null;
  }

  async updateBaja(id: string, patch: Partial<BajaRow>): Promise<ComunicacionBaja> {
    await this.db.update(schema.billingBajas).set(patch).where(eq(schema.billingBajas.id, id));
    const row = await this.db.select().from(schema.billingBajas).where(eq(schema.billingBajas.id, id)).get();
    if (!row) throw new Error(`Comunicación de baja ${id} no encontrada tras actualizar.`);
    return toBaja(row);
  }

  async saveBajaCdr(id: string, cdrBase64: string): Promise<void> {
    await this.db.update(schema.billingBajas).set({ cdrBase64 }).where(eq(schema.billingBajas.id, id));
  }

  async getBajaXml(id: string): Promise<string | null> {
    const row = await this.db.select({ xmlBase64: schema.billingBajas.xmlBase64 }).from(schema.billingBajas).where(eq(schema.billingBajas.id, id)).get();
    if (!row?.xmlBase64) return null;
    return Buffer.from(row.xmlBase64, "base64").toString("utf-8");
  }
}
