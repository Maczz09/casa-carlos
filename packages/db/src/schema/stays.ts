import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const staysClientes = sqliteTable("stays_clientes", {
  id: text("id").primaryKey(),
  nombres: text("nombres").notNull(),
  apellidos: text("apellidos").notNull(),
  dni: text("dni").notNull().unique(),
  telefono: text("telefono"),
  creadoEn: text("creado_en").notNull(),
});

export const staysEstadias = sqliteTable("stays_estadias", {
  id: text("id").primaryKey(),
  cuartoId: text("cuarto_id").notNull(),
  clienteId: text("cliente_id")
    .notNull()
    .references(() => staysClientes.id),
  modalidadId: text("modalidad_id").notNull(),
  ventaId: text("venta_id"),
  tipo: text("tipo", { enum: ["RESERVA", "DIRECTA"] }).notNull(),
  estado: text("estado", {
    enum: ["RESERVADA", "EN_CURSO", "EN_TOLERANCIA", "EXCEDIDA", "FINALIZADA", "ANULADA"],
  }).notNull(),
  bloqueoDesde: text("bloqueo_desde").notNull(),
  bloqueoHasta: text("bloqueo_hasta").notNull(),
  checkinPrevisto: text("checkin_previsto").notNull(),
  checkinReal: text("checkin_real"),
  checkoutPrevisto: text("checkout_previsto").notNull(),
  checkoutReal: text("checkout_real"),
  noches: integer("noches").notNull().default(0),
  toleranciaMin: integer("tolerancia_min").notNull().default(15),
  notificadoExcesoEn: text("notificado_exceso_en"),
  motivoAnulacion: text("motivo_anulacion"),
  usuarioId: text("usuario_id").notNull(),
  creadoEn: text("creado_en").notNull(),
});
