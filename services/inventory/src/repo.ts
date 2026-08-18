import { and, eq, lte } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";
import type { Product, ProductCategory, ProductMovement } from "@casacarlos/contracts";

type ProductRow = typeof schema.inventoryProductos.$inferSelect;
type CategoryRow = typeof schema.inventoryCategorias.$inferSelect;
type MovementRow = typeof schema.inventoryMovimientos.$inferSelect;

/** `categoriaNombre` viene del join — el producto solo guarda el id. */
const toProduct = (r: ProductRow, categoriaNombre: string | null = null): Product => ({
  id: r.id,
  codigoBarras: r.codigoBarras,
  nombre: r.nombre,
  descripcion: r.descripcion,
  categoriaId: r.categoriaId,
  categoria: categoriaNombre,
  precioCentimos: r.precioCentimos,
  costoCentimos: r.costoCentimos,
  stock: r.stock,
  stockMinimo: r.stockMinimo,
  estado: r.estado,
  activo: r.activo,
  creadoEn: r.creadoEn,
});

const toCategory = (r: CategoryRow): ProductCategory => ({
  id: r.id,
  nombre: r.nombre,
  descripcion: r.descripcion,
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

  /* ---------------- Categorías ---------------- */

  async listCategories(): Promise<ProductCategory[]> {
    const rows = await this.db.select().from(schema.inventoryCategorias).all();
    return rows.map(toCategory).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }

  async getCategory(id: string): Promise<ProductCategory | null> {
    const row = await this.db.select().from(schema.inventoryCategorias).where(eq(schema.inventoryCategorias.id, id)).get();
    return row ? toCategory(row) : null;
  }

  async findCategoryByName(nombre: string): Promise<ProductCategory | null> {
    const row = await this.db.select().from(schema.inventoryCategorias).where(eq(schema.inventoryCategorias.nombre, nombre)).get();
    return row ? toCategory(row) : null;
  }

  async insertCategory(row: CategoryRow): Promise<ProductCategory> {
    await this.db.insert(schema.inventoryCategorias).values(row);
    return toCategory(row);
  }

  async updateCategory(id: string, patch: Partial<CategoryRow>): Promise<ProductCategory> {
    await this.db.update(schema.inventoryCategorias).set(patch).where(eq(schema.inventoryCategorias.id, id));
    const updated = await this.getCategory(id);
    if (!updated) throw new Error(`Categoría ${id} no encontrada tras actualizar.`);
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.db.delete(schema.inventoryCategorias).where(eq(schema.inventoryCategorias.id, id));
  }

  async countProductsInCategory(categoriaId: string): Promise<number> {
    const rows = await this.db.select().from(schema.inventoryProductos).where(eq(schema.inventoryProductos.categoriaId, categoriaId)).all();
    return rows.length;
  }

  /* ---------------- Productos ---------------- */

  async insertProduct(row: ProductRow): Promise<Product> {
    await this.db.insert(schema.inventoryProductos).values(row);
    const found = await this.getProduct(row.id);
    return found ?? toProduct(row);
  }

  async getProduct(id: string): Promise<Product | null> {
    const row = await this.db
      .select()
      .from(schema.inventoryProductos)
      .leftJoin(schema.inventoryCategorias, eq(schema.inventoryProductos.categoriaId, schema.inventoryCategorias.id))
      .where(eq(schema.inventoryProductos.id, id))
      .get();
    return row ? toProduct(row.inventory_productos, row.inventory_categorias?.nombre ?? null) : null;
  }

  async findByBarcode(codigoBarras: string): Promise<Product | null> {
    const row = await this.db
      .select()
      .from(schema.inventoryProductos)
      .leftJoin(schema.inventoryCategorias, eq(schema.inventoryProductos.categoriaId, schema.inventoryCategorias.id))
      .where(eq(schema.inventoryProductos.codigoBarras, codigoBarras))
      .get();
    return row ? toProduct(row.inventory_productos, row.inventory_categorias?.nombre ?? null) : null;
  }

  async updateProduct(id: string, patch: Partial<ProductRow>): Promise<Product> {
    await this.db.update(schema.inventoryProductos).set(patch).where(eq(schema.inventoryProductos.id, id));
    const updated = await this.getProduct(id);
    if (!updated) throw new Error(`Producto ${id} no encontrado tras actualizar.`);
    return updated;
  }

  async listProducts(): Promise<Product[]> {
    const rows = await this.db
      .select()
      .from(schema.inventoryProductos)
      .leftJoin(schema.inventoryCategorias, eq(schema.inventoryProductos.categoriaId, schema.inventoryCategorias.id))
      .where(eq(schema.inventoryProductos.activo, true))
      .all();
    return rows.map((r) => toProduct(r.inventory_productos, r.inventory_categorias?.nombre ?? null));
  }

  async listLowStock(): Promise<Product[]> {
    const rows = await this.db
      .select()
      .from(schema.inventoryProductos)
      .leftJoin(schema.inventoryCategorias, eq(schema.inventoryProductos.categoriaId, schema.inventoryCategorias.id))
      .where(and(eq(schema.inventoryProductos.activo, true), lte(schema.inventoryProductos.stock, schema.inventoryProductos.stockMinimo)))
      .all();
    return rows.map((r) => toProduct(r.inventory_productos, r.inventory_categorias?.nombre ?? null));
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
