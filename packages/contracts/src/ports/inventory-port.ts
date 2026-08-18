import type { Product, ProductMovement, ProductState } from "../entities/inventory.js";

export interface CreateProductInput {
  codigoBarras?: string | null;
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  precioCentimos: number;
  costoCentimos?: number;
  stockInicial?: number;
  stockMinimo?: number;
  usuarioId: string;
}

export interface UpdateProductInput {
  nombre?: string;
  descripcion?: string | null;
  categoria?: string | null;
  precioCentimos?: number;
  costoCentimos?: number;
  stockMinimo?: number;
  estado?: ProductState;
}

export interface DispatchInput {
  productoId: string;
  cantidad: number;
  cuartoId?: string | null;
  ventaId?: string | null;
  lineaVentaId?: string | null;
  usuarioId: string;
}

export interface StockAdjustmentInput {
  productoId: string;
  /** Positivo para ingreso, negativo para merma o corrección. */
  cantidad: number;
  motivo: string;
  usuarioId: string;
}

/**
 * Public surface of `inventory`. Dueño de `inventory_productos` e
 * `inventory_movimientos` (el kardex, solo-append). `sales` llama a
 * `dispatch`/`returnStock` para reflejar consumo en una venta; nunca escribe
 * directamente sobre el stock.
 */
export interface InventoryPort {
  createProduct(input: CreateProductInput): Promise<Product>;
  updateProduct(id: string, patch: UpdateProductInput): Promise<Product>;
  getProduct(id: string): Promise<Product>;
  findByBarcode(codigoBarras: string): Promise<Product | null>;
  listProducts(): Promise<Product[]>;
  listLowStock(): Promise<Product[]>;

  registerStockIn(input: StockAdjustmentInput): Promise<ProductMovement>;
  adjustStock(input: StockAdjustmentInput): Promise<ProductMovement>;

  /** Descuenta stock y deja rastro en el kardex — lo llama `sales` al agregar una línea de producto. */
  dispatch(input: DispatchInput): Promise<ProductMovement>;
  /** Devuelve el stock de una línea anulada (BOD-10). */
  returnStock(input: { lineaVentaId: string; usuarioId: string; motivo: string }): Promise<ProductMovement>;

  listMovements(productoId: string): Promise<ProductMovement[]>;
}
