import { and, eq, gte, lte, or, inArray } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";
import type { Sale, SaleLine } from "@casacarlos/contracts";

type SaleRow = typeof schema.salesVentas.$inferSelect;
type LineRow = typeof schema.salesLineas.$inferSelect;

const toSale = (r: SaleRow): Sale => ({
  id: r.id,
  serie: r.serie,
  correlativo: r.correlativo,
  tipo: r.tipo,
  estado: r.estado,
  estadiaId: r.estadiaId,
  cuartoId: r.cuartoId,
  clienteNombres: r.clienteNombres,
  clienteApellidos: r.clienteApellidos,
  clienteDni: r.clienteDni,
  totalCentimos: r.totalCentimos,
  pagadoCentimos: r.pagadoCentimos,
  saldoCentimos: r.saldoCentimos,
  usuarioId: r.usuarioId,
  pagadaEn: r.pagadaEn,
  cerradaEn: r.cerradaEn,
  motivoAnulacion: r.motivoAnulacion,
  creadoEn: r.creadoEn,
});

const toLine = (r: LineRow): SaleLine => ({
  id: r.id,
  ventaId: r.ventaId,
  tipo: r.tipo,
  referenciaId: r.referenciaId,
  intervaloMinutos: r.intervaloMinutos,
  descripcion: r.descripcion,
  cantidad: r.cantidad,
  precioUnitarioCentimos: r.precioUnitarioCentimos,
  subtotalCentimos: r.subtotalCentimos,
  fase: r.fase,
  anulada: r.anulada,
  motivoAnulacion: r.motivoAnulacion,
  usuarioId: r.usuarioId,
  creadoEn: r.creadoEn,
});

export class SalesRepo {
  constructor(private readonly db: Db) {}

  async nextCorrelativo(serie: string): Promise<number> {
    const rows = await this.db.select({ correlativo: schema.salesVentas.correlativo }).from(schema.salesVentas).where(eq(schema.salesVentas.serie, serie)).all();
    return rows.reduce((max, r) => Math.max(max, r.correlativo), 0) + 1;
  }

  async insertSale(row: SaleRow): Promise<Sale> {
    await this.db.insert(schema.salesVentas).values(row);
    return toSale(row);
  }

  async getSale(id: string): Promise<Sale | null> {
    const row = await this.db.select().from(schema.salesVentas).where(eq(schema.salesVentas.id, id)).get();
    return row ? toSale(row) : null;
  }

  async getSaleByStay(estadiaId: string): Promise<Sale | null> {
    const row = await this.db.select().from(schema.salesVentas).where(eq(schema.salesVentas.estadiaId, estadiaId)).get();
    return row ? toSale(row) : null;
  }

  async listOpen(): Promise<Sale[]> {
    const rows = await this.db.select().from(schema.salesVentas).where(inArray(schema.salesVentas.estado, ["ABIERTA", "PAGADA", "CON_SALDO"])).all();
    return rows.map(toSale);
  }

  /**
   * Ventas creadas dentro del rango, más nueva primero. `desde`/`hasta` son días
   * (YYYY-MM-DD) y se comparan contra el ISO completo guardado en `creado_en`:
   * el ISO-8601 ordena igual como texto que como fecha, así que alcanza con
   * comparar strings — por eso `hasta` se extiende al final del día.
   */
  async listByRange(desde: string, hasta: string): Promise<Sale[]> {
    const { start, end } = peruRange(desde, hasta);
    const entries = await this.db.select({ ventaId: schema.cashboxMovimientos.ventaId }).from(schema.cashboxMovimientos).where(and(gte(schema.cashboxMovimientos.ocurridoEn, start), lte(schema.cashboxMovimientos.ocurridoEn, end))).all();
    const ids = entries.map((m) => m.ventaId).filter((id): id is string => !!id);
    const rows = await this.db
      .select()
      .from(schema.salesVentas)
      .where(or(and(gte(schema.salesVentas.creadoEn, start), lte(schema.salesVentas.creadoEn, end)), and(gte(schema.salesVentas.cerradaEn, start), lte(schema.salesVentas.cerradaEn, end)), ids.length ? inArray(schema.salesVentas.id, ids) : undefined))
      .all();
    return rows.map(toSale).sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  }

  async listCancelled(desde?: string, hasta?: string): Promise<Sale[]> {
    const start = desde ? peruRange(desde, desde).start : "";
    const end = hasta ? peruRange(hasta, hasta).end : "9999";
    if (desde && hasta && desde > hasta) throw new Error("Rango de fechas inválido.");
    const rows = await this.db.select().from(schema.salesVentas).where(eq(schema.salesVentas.estado, "ANULADA")).all();
    const audit = await this.db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entidad, "sales_ventas"), eq(schema.auditLog.accion, "ANULAR"))).all();
    const dates = new Map(audit.map((a) => [a.entidadId, a.ocurridoEn]));
    return rows.filter((v) => { const at = dates.get(v.id) ?? v.creadoEn; return at >= start && at <= end; }).map(toSale).sort((a, b) => (dates.get(b.id) ?? b.creadoEn).localeCompare(dates.get(a.id) ?? a.creadoEn));
  }

  async updateSale(id: string, patch: Partial<SaleRow>): Promise<Sale> {
    await this.db.update(schema.salesVentas).set(patch).where(eq(schema.salesVentas.id, id));
    const updated = await this.getSale(id);
    if (!updated) throw new Error(`Venta ${id} no encontrada tras actualizar.`);
    return updated;
  }

  async insertLine(input: Omit<LineRow, "intervaloMinutos"> & { intervaloMinutos?: number | null }): Promise<SaleLine> {
    const row = { ...input, intervaloMinutos: input.intervaloMinutos ?? null };
    await this.db.insert(schema.salesLineas).values(row);
    return toLine(row);
  }

  async listLines(ventaId: string, includeCancelled = false): Promise<SaleLine[]> {
    const rows = await this.db
      .select()
      .from(schema.salesLineas)
      .where(and(eq(schema.salesLineas.ventaId, ventaId), includeCancelled ? undefined : eq(schema.salesLineas.anulada, false)))
      .all();
    return rows.map(toLine);
  }

  async getLine(id: string): Promise<SaleLine | null> {
    const row = await this.db.select().from(schema.salesLineas).where(eq(schema.salesLineas.id, id)).get();
    return row ? toLine(row) : null;
  }

  async updateLine(id: string, patch: Partial<LineRow>): Promise<SaleLine> {
    await this.db.update(schema.salesLineas).set(patch).where(eq(schema.salesLineas.id, id));
    const updated = await this.getLine(id);
    if (!updated) throw new Error(`Línea ${id} no encontrada tras actualizar.`);
    return updated;
  }
}

function peruRange(desde: string, hasta: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta) || desde > hasta) throw new Error("Rango de fechas inválido.");
  return { start: new Date(desde + "T00:00:00.000-05:00").toISOString(), end: new Date(hasta + "T23:59:59.999-05:00").toISOString() };
}
