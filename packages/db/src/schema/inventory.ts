import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Categorías de producto. Antes la categoría era texto libre en cada producto,
 * lo que producía duplicados por tipeo ("Bebidas" / "bebidas" / "Bebida") y
 * hacía imposible filtrar de forma confiable. Ahora es una tabla propia y el
 * producto la referencia.
 */
export const inventoryCategorias = sqliteTable("inventory_categorias", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull().unique(),
  descripcion: text("descripcion"),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  creadoEn: text("creado_en").notNull(),
});

export const inventoryProductos = sqliteTable("inventory_productos", {
  id: text("id").primaryKey(),
  codigoBarras: text("codigo_barras").unique(),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  categoriaId: text("categoria_id").references(() => inventoryCategorias.id),
  precioCentimos: integer("precio_centimos").notNull(),
  costoCentimos: integer("costo_centimos").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  stockMinimo: integer("stock_minimo").notNull().default(0),
  estado: text("estado", { enum: ["ACTIVO", "AGOTADO", "DESCONTINUADO"] }).notNull().default("ACTIVO"),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  creadoEn: text("creado_en").notNull(),
});

export const inventoryProductoImagenes = sqliteTable("inventory_producto_imagenes", {
  id: text("id").primaryKey(),
  productoId: text("producto_id")
    .notNull()
    .references(() => inventoryProductos.id, { onDelete: "cascade" }),
  archivo: text("archivo").notNull().unique(),
  mimeType: text("mime_type", { enum: ["image/jpeg", "image/png", "image/webp"] }).notNull(),
  tamanoBytes: integer("tamano_bytes").notNull(),
  orden: integer("orden").notNull(),
  creadoEn: text("creado_en").notNull(),
  creadoPor: text("creado_por").notNull(),
});

export const inventoryMovimientos = sqliteTable("inventory_movimientos", {
  id: text("id").primaryKey(),
  productoId: text("producto_id")
    .notNull()
    .references(() => inventoryProductos.id),
  tipo: text("tipo", { enum: ["INGRESO", "SALIDA", "AJUSTE", "ANULACION"] }).notNull(),
  cantidad: integer("cantidad").notNull(),
  stockResultante: integer("stock_resultante").notNull(),
  cuartoId: text("cuarto_id"),
  ventaId: text("venta_id"),
  lineaVentaId: text("linea_venta_id"),
  motivo: text("motivo"),
  usuarioId: text("usuario_id").notNull(),
  ocurridoEn: text("ocurrido_en").notNull(),
});
