import type { Db } from "@casacarlos/db";
import { recordAudit } from "@casacarlos/db";
import { newId } from "@casacarlos/contracts";
import type {
  AddProductImageInput,
  CreateProductCategoryInput,
  CreateProductInput,
  DispatchInput,
  InventoryPort,
  MovementType,
  Product,
  ProductCategory,
  ProductImage,
  ProductMovement,
  StockAdjustmentInput,
  UpdateProductCategoryInput,
  UpdateProductInput,
} from "@casacarlos/contracts";
import type { EventBus } from "@casacarlos/bus";
import { InventoryRepo } from "./repo.js";

export class InventoryService implements InventoryPort {
  private readonly repo: InventoryRepo;

  constructor(
    private readonly db: Db,
    private readonly bus: EventBus,
  ) {
    this.repo = new InventoryRepo(db);
  }

  /* ---------------- Categorías ---------------- */

  async listCategories(): Promise<ProductCategory[]> {
    return this.repo.listCategories();
  }

  async createCategory(input: CreateProductCategoryInput): Promise<ProductCategory> {
    const nombre = input.nombre.trim();
    if (!nombre) throw new Error("El nombre de la categoría no puede estar vacío.");
    if (await this.repo.findCategoryByName(nombre)) throw new Error(`Ya existe una categoría llamada "${nombre}".`);
    const category = await this.repo.insertCategory({
      id: newId(),
      nombre,
      descripcion: input.descripcion?.trim() || null,
      activo: true,
      creadoEn: new Date().toISOString(),
    });
    await this.bus.publish("inventory.catalog_changed", { productoId: null });
    return category;
  }

  async updateCategory(id: string, patch: UpdateProductCategoryInput): Promise<ProductCategory> {
    const current = await this.repo.getCategory(id);
    if (!current) throw new Error(`Categoría ${id} no encontrada.`);

    const nombre = patch.nombre?.trim();
    if (nombre !== undefined) {
      if (!nombre) throw new Error("El nombre de la categoría no puede estar vacío.");
      const clash = await this.repo.findCategoryByName(nombre);
      if (clash && clash.id !== id) throw new Error(`Ya existe una categoría llamada "${nombre}".`);
    }

    const category = await this.repo.updateCategory(id, {
      ...(nombre !== undefined ? { nombre } : {}),
      ...(patch.descripcion !== undefined ? { descripcion: patch.descripcion?.trim() || null } : {}),
      ...(patch.activo !== undefined ? { activo: patch.activo } : {}),
    });
    await this.bus.publish("inventory.catalog_changed", { productoId: null });
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    const current = await this.repo.getCategory(id);
    if (!current) throw new Error(`Categoría ${id} no encontrada.`);
    // Borrar dejaría los productos apuntando a una categoría inexistente. Se
    // bloquea a propósito: primero hay que mover o dar de baja esos productos.
    const enUso = await this.repo.countProductsInCategory(id);
    if (enUso > 0) throw new Error(`No se puede borrar: ${enUso} producto${enUso === 1 ? "" : "s"} usa${enUso === 1 ? "" : "n"} esta categoría.`);
    await this.repo.deleteCategory(id);
    await this.bus.publish("inventory.catalog_changed", { productoId: null });
  }

  /* ---------------- Productos ---------------- */

  async createProduct(input: CreateProductInput): Promise<Product> {
    const now = new Date().toISOString();
    const stockInicial = input.stockInicial ?? 0;
    if (input.categoriaId && !(await this.repo.getCategory(input.categoriaId))) {
      throw new Error("La categoría elegida no existe.");
    }
    const product = await this.repo.insertProduct({
      id: newId(),
      codigoBarras: input.codigoBarras ?? null,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      categoriaId: input.categoriaId ?? null,
      precioCentimos: input.precioCentimos,
      costoCentimos: input.costoCentimos ?? 0,
      stock: stockInicial,
      stockMinimo: input.stockMinimo ?? 0,
      estado: "ACTIVO",
      activo: true,
      creadoEn: now,
    });

    if (stockInicial > 0) {
      await this.repo.insertMovement({
        id: newId(),
        productoId: product.id,
        tipo: "INGRESO",
        cantidad: stockInicial,
        stockResultante: stockInicial,
        cuartoId: null,
        ventaId: null,
        lineaVentaId: null,
        motivo: "Alta de producto",
        usuarioId: input.usuarioId,
        ocurridoEn: now,
      });
    }

    await recordAudit(this.db, { entidad: "inventory_productos", entidadId: product.id, accion: "CREAR", usuarioId: input.usuarioId, despues: product });
    await this.bus.publish("inventory.catalog_changed", { productoId: product.id });
    return product;
  }

  async updateProduct(id: string, patch: UpdateProductInput, usuarioId: string): Promise<Product> {
    const before = await this.getProduct(id);
    if (patch.categoriaId && !(await this.repo.getCategory(patch.categoriaId))) {
      throw new Error("La categoría elegida no existe.");
    }
    if (patch.precioCentimos !== undefined && patch.precioCentimos < 0) throw new Error("El precio no puede ser negativo.");
    const product = await this.repo.updateProduct(id, patch);
    await recordAudit(this.db, { entidad: "inventory_productos", entidadId: id, accion: "ACTUALIZAR", usuarioId, antes: before, despues: product });
    await this.bus.publish("inventory.catalog_changed", { productoId: id });
    return product;
  }

  async updateProductPrice(id: string, precioCentimos: number, usuarioId: string): Promise<Product> {
    if (!Number.isInteger(precioCentimos) || precioCentimos < 0) throw new Error("El precio debe ser un monto válido.");
    const before = await this.getProduct(id);
    const product = await this.repo.updateProduct(id, { precioCentimos });
    await recordAudit(this.db, {
      entidad: "inventory_productos",
      entidadId: id,
      accion: "CAMBIAR_PRECIO",
      usuarioId,
      antes: { precioCentimos: before.precioCentimos },
      despues: { precioCentimos },
    });
    await this.bus.publish("inventory.catalog_changed", { productoId: id });
    return product;
  }

  async getProduct(id: string): Promise<Product> {
    const product = await this.repo.getProduct(id);
    if (!product) throw new Error(`Producto ${id} no encontrado.`);
    return product;
  }

  async findByBarcode(codigoBarras: string): Promise<Product | null> {
    return this.repo.findByBarcode(codigoBarras);
  }

  async listProducts(): Promise<Product[]> {
    return this.repo.listProducts();
  }

  async listLowStock(): Promise<Product[]> {
    return this.repo.listLowStock();
  }

  async addProductImage(input: AddProductImageInput): Promise<ProductImage> {
    await this.getProduct(input.productoId);
    const current = await this.repo.listImages(input.productoId);
    if (current.length >= 4) throw new Error("Cada producto admite como máximo 4 imágenes.");
    const image = await this.repo.insertImage({
      id: newId(),
      productoId: input.productoId,
      archivo: input.archivo,
      mimeType: input.mimeType,
      tamanoBytes: input.tamanoBytes,
      orden: current.length,
      creadoEn: new Date().toISOString(),
      creadoPor: input.usuarioId,
    });
    await recordAudit(this.db, { entidad: "inventory_producto_imagenes", entidadId: image.id, accion: "CREAR", usuarioId: input.usuarioId, despues: image });
    await this.bus.publish("inventory.catalog_changed", { productoId: input.productoId });
    return image;
  }

  async reorderProductImages(productoId: string, imageIds: string[], usuarioId: string): Promise<ProductImage[]> {
    const current = await this.repo.listImages(productoId);
    const expected = new Set(current.map((image) => image.id));
    if (imageIds.length !== current.length || new Set(imageIds).size !== imageIds.length || imageIds.some((id) => !expected.has(id))) {
      throw new Error("El orden enviado no coincide con las imágenes del producto.");
    }
    for (const [orden, id] of imageIds.entries()) await this.repo.updateImageOrder(id, orden);
    const images = await this.repo.listImages(productoId);
    await recordAudit(this.db, { entidad: "inventory_productos", entidadId: productoId, accion: "REORDENAR_IMAGENES", usuarioId, despues: imageIds });
    await this.bus.publish("inventory.catalog_changed", { productoId });
    return images;
  }

  async deleteProductImage(productoId: string, imageId: string, usuarioId: string): Promise<ProductImage> {
    const image = await this.repo.getImage(imageId);
    if (!image || image.productoId !== productoId) throw new Error("Imagen no encontrada para ese producto.");
    await this.repo.deleteImage(imageId);
    const remaining = await this.repo.listImages(productoId);
    for (const [orden, item] of remaining.entries()) await this.repo.updateImageOrder(item.id, orden);
    await recordAudit(this.db, { entidad: "inventory_producto_imagenes", entidadId: imageId, accion: "ELIMINAR", usuarioId, antes: image });
    await this.bus.publish("inventory.catalog_changed", { productoId });
    return image;
  }

  async registerStockIn(input: StockAdjustmentInput): Promise<ProductMovement> {
    if (input.cantidad <= 0) throw new Error("El ingreso de stock debe ser una cantidad positiva.");
    return this.applyMovement("INGRESO", input.productoId, input.cantidad, input.motivo, input.usuarioId, {});
  }

  async adjustStock(input: StockAdjustmentInput): Promise<ProductMovement> {
    if (input.cantidad === 0) throw new Error("El ajuste no puede ser cero.");
    return this.applyMovement("AJUSTE", input.productoId, input.cantidad, input.motivo, input.usuarioId, {});
  }

  async dispatch(input: DispatchInput): Promise<ProductMovement> {
    const product = await this.getProduct(input.productoId);
    if (product.stock < input.cantidad) {
      throw new Error(`Stock insuficiente de "${product.nombre}": quedan ${product.stock}, se pidieron ${input.cantidad}.`);
    }
    const movement = await this.applyMovement("SALIDA", input.productoId, -input.cantidad, null, input.usuarioId, {
      cuartoId: input.cuartoId ?? null,
      ventaId: input.ventaId ?? null,
      lineaVentaId: input.lineaVentaId ?? null,
    });
    await this.bus.publish("inventory.dispatched", { productoId: input.productoId, cantidad: input.cantidad, lineaVentaId: input.lineaVentaId ?? null });
    return movement;
  }

  async returnStock(input: { lineaVentaId: string; usuarioId: string; motivo: string }): Promise<ProductMovement> {
    const original = await this.repo.findMovementByLine(input.lineaVentaId);
    if (!original) throw new Error(`No se encontró el despacho para la línea ${input.lineaVentaId}.`);
    return this.applyMovement("ANULACION", original.productoId, Math.abs(original.cantidad), input.motivo, input.usuarioId, {
      lineaVentaId: input.lineaVentaId,
    });
  }

  async listMovements(productoId: string): Promise<ProductMovement[]> {
    return this.repo.listMovements(productoId);
  }

  private async applyMovement(
    tipo: MovementType,
    productoId: string,
    cantidad: number,
    motivo: string | null,
    usuarioId: string,
    extra: { cuartoId?: string | null; ventaId?: string | null; lineaVentaId?: string | null },
  ): Promise<ProductMovement> {
    const product = await this.getProduct(productoId);
    const stockResultante = product.stock + cantidad;
    if (stockResultante < 0) {
      throw new Error(`Ese movimiento dejaría stock negativo para "${product.nombre}" (actual: ${product.stock}).`);
    }

    const estado =
      stockResultante === 0 && product.estado !== "DESCONTINUADO"
        ? "AGOTADO"
        : stockResultante > 0 && product.estado === "AGOTADO"
          ? "ACTIVO"
          : product.estado;
    await this.repo.updateProduct(productoId, { stock: stockResultante, estado });

    const movement = await this.repo.insertMovement({
      id: newId(),
      productoId,
      tipo,
      cantidad,
      stockResultante,
      cuartoId: extra.cuartoId ?? null,
      ventaId: extra.ventaId ?? null,
      lineaVentaId: extra.lineaVentaId ?? null,
      motivo,
      usuarioId,
      ocurridoEn: new Date().toISOString(),
    });

    if (stockResultante <= product.stockMinimo) {
      await this.bus.publish("inventory.low_stock", { productoId, nombre: product.nombre, stock: stockResultante, stockMinimo: product.stockMinimo });
    }

    await this.bus.publish("inventory.catalog_changed", { productoId });

    return movement;
  }
}
