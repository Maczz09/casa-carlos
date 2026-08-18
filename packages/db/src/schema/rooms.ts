import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";

export const roomsPisos = sqliteTable("rooms_pisos", {
  id: text("id").primaryKey(),
  numero: integer("numero").notNull(),
  nombre: text("nombre").notNull(),
  orden: integer("orden").notNull(),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
});

export const roomsAtributos = sqliteTable("rooms_atributos", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
});

export const roomsCategorias = sqliteTable("rooms_categorias", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  camas: integer("camas").notNull().default(1),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
});

export const roomsCategoriaAtributos = sqliteTable(
  "rooms_categoria_atributos",
  {
    categoriaId: text("categoria_id")
      .notNull()
      .references(() => roomsCategorias.id),
    atributoId: text("atributo_id")
      .notNull()
      .references(() => roomsAtributos.id),
  },
  (t) => [primaryKey({ columns: [t.categoriaId, t.atributoId] })],
);

export const roomsCuartos = sqliteTable("rooms_cuartos", {
  id: text("id").primaryKey(),
  numero: text("numero").notNull().unique(),
  pisoId: text("piso_id")
    .notNull()
    .references(() => roomsPisos.id),
  categoriaId: text("categoria_id")
    .notNull()
    .references(() => roomsCategorias.id),
  descripcion: text("descripcion"),
  incluye: text("incluye"),
  fueraDeServicio: integer("fuera_de_servicio", { mode: "boolean" }).notNull().default(false),
  motivoFueraServicio: text("motivo_fuera_servicio"),
  limpiezaHasta: text("limpieza_hasta"),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  creadoEn: text("creado_en").notNull(),
});

export const roomsHistorialEstado = sqliteTable("rooms_historial_estado", {
  id: text("id").primaryKey(),
  cuartoId: text("cuarto_id")
    .notNull()
    .references(() => roomsCuartos.id),
  estadoAnterior: text("estado_anterior").notNull(),
  estadoNuevo: text("estado_nuevo").notNull(),
  estadiaId: text("estadia_id"),
  usuarioId: text("usuario_id"),
  ocurridoEn: text("ocurrido_en").notNull(),
});
