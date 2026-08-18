import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const inventoryProductos = sqliteTable("inventory_productos", {
  id: text("id").primaryKey(),
  codigoBarras: text("codigo_barras").unique(),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  categoria: text("categoria"),
  precioCentimos: integer("precio_centimos").notNull(),
  costoCentimos: integer("costo_centimos").notNull().default(0),
  stock: integer("stock").notNull().default(0),
  stockMinimo: integer("stock_minimo").notNull().default(0),
  estado: text("estado", { enum: ["ACTIVO", "AGOTADO", "DESCONTINUADO"] }).notNull().default("ACTIVO"),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  creadoEn: text("creado_en").notNull(),
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
