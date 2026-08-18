import { and, eq } from "drizzle-orm";
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
    const rows = await this.db.select().from(schema.salesVentas).where(eq(schema.salesVentas.estado, "ABIERTA")).all();
    return rows.map(toSale);
  }

  async updateSale(id: string, patch: Partial<SaleRow>): Promise<Sale> {
    await this.db.update(schema.salesVentas).set(patch).where(eq(schema.salesVentas.id, id));
    const updated = await this.getSale(id);
    if (!updated) throw new Error(`Venta ${id} no encontrada tras actualizar.`);
    return updated;
  }

  async insertLine(row: LineRow): Promise<SaleLine> {
    await this.db.insert(schema.salesLineas).values(row);
    return toLine(row);
  }

  async listLines(ventaId: string): Promise<SaleLine[]> {
    const rows = await this.db
      .select()
      .from(schema.salesLineas)
      .where(and(eq(schema.salesLineas.ventaId, ventaId), eq(schema.salesLineas.anulada, false)))
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
