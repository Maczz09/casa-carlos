import type { Db } from "@casacarlos/db";
import { recordAudit } from "@casacarlos/db";
import { newId } from "@casacarlos/contracts";
import type {
  CreateProductInput,
  DispatchInput,
  InventoryPort,
  MovementType,
  Product,
  ProductMovement,
  StockAdjustmentInput,
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

  async createProduct(input: CreateProductInput): Promise<Product> {
    const now = new Date().toISOString();
    const stockInicial = input.stockInicial ?? 0;
    const product = await this.repo.insertProduct({
      id: newId(),
      codigoBarras: input.codigoBarras ?? null,
      nombre: input.nombre,
      descripcion: input.descripcion ?? null,
      categoria: input.categoria ?? null,
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
    return product;
  }

  async updateProduct(id: string, patch: UpdateProductInput): Promise<Product> {
    return this.repo.updateProduct(id, patch);
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

    return movement;
  }
}
