import { and, eq, lte } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";
import type { Product, ProductMovement } from "@casacarlos/contracts";

type ProductRow = typeof schema.inventoryProductos.$inferSelect;
type MovementRow = typeof schema.inventoryMovimientos.$inferSelect;

const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  codigoBarras: r.codigoBarras,
  nombre: r.nombre,
  descripcion: r.descripcion,
  categoria: r.categoria,
  precioCentimos: r.precioCentimos,
  costoCentimos: r.costoCentimos,
  stock: r.stock,
  stockMinimo: r.stockMinimo,
  estado: r.estado,
  activo: r.activo,
  creadoEn: r.creadoEn,
});

const toMovement = (r: MovementRow): ProductMovement => ({
  id: r.id,
  productoId: r.productoId,
  tipo: r.tipo,
  cantidad: r.cantidad,
  stockResultante: r.stockResultante,
  cuartoId: r.cuartoId,
  ventaId: r.ventaId,
  lineaVentaId: r.lineaVentaId,
  motivo: r.motivo,
  usuarioId: r.usuarioId,
  ocurridoEn: r.ocurridoEn,
});

export class InventoryRepo {
  constructor(private readonly db: Db) {}

  async insertProduct(row: ProductRow): Promise<Product> {
    await this.db.insert(schema.inventoryProductos).values(row);
    return toProduct(row);
  }

  async getProduct(id: string): Promise<Product | null> {
    const row = await this.db.select().from(schema.inventoryProductos).where(eq(schema.inventoryProductos.id, id)).get();
    return row ? toProduct(row) : null;
  }

  async findByBarcode(codigoBarras: string): Promise<Product | null> {
    const row = await this.db.select().from(schema.inventoryProductos).where(eq(schema.inventoryProductos.codigoBarras, codigoBarras)).get();
    return row ? toProduct(row) : null;
  }

  async updateProduct(id: string, patch: Partial<ProductRow>): Promise<Product> {
    await this.db.update(schema.inventoryProductos).set(patch).where(eq(schema.inventoryProductos.id, id));
    const updated = await this.getProduct(id);
    if (!updated) throw new Error(`Producto ${id} no encontrado tras actualizar.`);
    return updated;
  }

  async listProducts(): Promise<Product[]> {
    const rows = await this.db.select().from(schema.inventoryProductos).where(eq(schema.inventoryProductos.activo, true)).all();
    return rows.map(toProduct);
  }

  async listLowStock(): Promise<Product[]> {
    const rows = await this.db
      .select()
      .from(schema.inventoryProductos)
      .where(and(eq(schema.inventoryProductos.activo, true), lte(schema.inventoryProductos.stock, schema.inventoryProductos.stockMinimo)))
      .all();
    return rows.map(toProduct);
  }

  async insertMovement(row: MovementRow): Promise<ProductMovement> {
    await this.db.insert(schema.inventoryMovimientos).values(row);
    return toMovement(row);
  }

  async listMovements(productoId: string): Promise<ProductMovement[]> {
    const rows = await this.db
      .select()
      .from(schema.inventoryMovimientos)
      .where(eq(schema.inventoryMovimientos.productoId, productoId))
      .all();
    return rows.map(toMovement).sort((a, b) => (a.ocurridoEn < b.ocurridoEn ? 1 : -1));
  }

  async findMovementByLine(lineaVentaId: string): Promise<ProductMovement | null> {
    const row = await this.db.select().from(schema.inventoryMovimientos).where(eq(schema.inventoryMovimientos.lineaVentaId, lineaVentaId)).get();
    return row ? toMovement(row) : null;
  }
}
