import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const salesVentas = sqliteTable(
  "sales_ventas",
  {
    id: text("id").primaryKey(),
    serie: text("serie").notNull(),
    correlativo: integer("correlativo").notNull(),
    tipo: text("tipo", { enum: ["COTIZACION", "VENTA"] }).notNull(),
    estado: text("estado", {
      enum: ["BORRADOR", "ABIERTA", "PAGADA", "CON_SALDO", "CERRADA", "ANULADA"],
    }).notNull(),
    estadiaId: text("estadia_id"),
    cuartoId: text("cuarto_id"),
    clienteNombres: text("cliente_nombres"),
    clienteApellidos: text("cliente_apellidos"),
    clienteDni: text("cliente_dni"),
    totalCentimos: integer("total_centimos").notNull().default(0),
    pagadoCentimos: integer("pagado_centimos").notNull().default(0),
    saldoCentimos: integer("saldo_centimos").notNull().default(0),
    usuarioId: text("usuario_id").notNull(),
    pagadaEn: text("pagada_en"),
    cerradaEn: text("cerrada_en"),
    motivoAnulacion: text("motivo_anulacion"),
    creadoEn: text("creado_en").notNull(),
  },
  (t) => [uniqueIndex("ux_venta_serie").on(t.serie, t.correlativo)],
);

export const salesLineas = sqliteTable("sales_lineas", {
  id: text("id").primaryKey(),
  ventaId: text("venta_id")
    .notNull()
    .references(() => salesVentas.id),
  tipo: text("tipo", { enum: ["HOSPEDAJE", "PRODUCTO", "CARGO_EXTRA"] }).notNull(),
  referenciaId: text("referencia_id"),
  descripcion: text("descripcion").notNull(),
  cantidad: integer("cantidad").notNull().default(1),
  precioUnitarioCentimos: integer("precio_unitario_centimos").notNull(),
  subtotalCentimos: integer("subtotal_centimos").notNull(),
  fase: text("fase", { enum: ["PRE_PAGO", "POST_PAGO"] }).notNull(),
  anulada: integer("anulada", { mode: "boolean" }).notNull().default(false),
  motivoAnulacion: text("motivo_anulacion"),
  usuarioId: text("usuario_id").notNull(),
  creadoEn: text("creado_en").notNull(),
});
