import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const pricingTemporadas = sqliteTable("pricing_temporadas", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
  desde: text("desde").notNull(),
  hasta: text("hasta").notNull(),
  prioridad: integer("prioridad").notNull().default(0),
  activa: integer("activa", { mode: "boolean" }).notNull().default(true),
});

export const pricingFranjas = sqliteTable("pricing_franjas", {
  id: text("id").primaryKey(),
  temporadaId: text("temporada_id")
    .notNull()
    .references(() => pricingTemporadas.id),
  horaInicio: text("hora_inicio").notNull(), // "HH:mm"
  orden: integer("orden").notNull(),
  etiqueta: text("etiqueta").notNull(),
});

export const pricingModalidades = sqliteTable("pricing_modalidades", {
  id: text("id").primaryKey(),
  codigo: text("codigo", { enum: ["HORAS_3", "NOCHE_A", "NOCHE_B"] }).notNull().unique(),
  nombre: text("nombre").notNull(),
  duracionHoras: integer("duracion_horas").notNull(),
  checkinFijo: text("checkin_fijo"),
  checkoutFijo: text("checkout_fijo"),
  toleranciaMin: integer("tolerancia_min").notNull().default(15),
  activa: integer("activa", { mode: "boolean" }).notNull().default(true),
});

export const pricingTarifas = sqliteTable("pricing_tarifas", {
  id: text("id").primaryKey(),
  franjaId: text("franja_id")
    .notNull()
    .references(() => pricingFranjas.id),
  categoriaId: text("categoria_id").notNull(),
  modalidadId: text("modalidad_id")
    .notNull()
    .references(() => pricingModalidades.id),
  precioCentimos: integer("precio_centimos").notNull(),
});

export const pricingEscalaNoches = sqliteTable("pricing_escala_noches", {
  id: text("id").primaryKey(),
  modalidadId: text("modalidad_id")
    .notNull()
    .references(() => pricingModalidades.id),
  categoriaId: text("categoria_id").notNull(),
  noches: integer("noches").notNull(),
  precioTotalCentimos: integer("precio_total_centimos").notNull(),
});

export const pricingCargos = sqliteTable("pricing_cargos", {
  id: text("id").primaryKey(),
  codigo: text("codigo", { enum: ["EARLY_CHECKIN", "EXCESO", "EXTENSION_3H"] }).notNull().unique(),
  nombre: text("nombre").notNull(),
  precioCentimos: integer("precio_centimos").notNull(),
  unidad: text("unidad", { enum: ["HORA", "BLOQUE", "FIJO"] }).notNull(),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
});
