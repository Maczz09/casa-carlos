import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cashboxPlantillasTurno = sqliteTable("cashbox_plantillas_turno", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
  horaInicio: text("hora_inicio").notNull(),
  horaFin: text("hora_fin").notNull(),
  orden: integer("orden").notNull().default(0),
  activa: integer("activa", { mode: "boolean" }).notNull().default(true),
});

export const cashboxTurnos = sqliteTable("cashbox_turnos", {
  id: text("id").primaryKey(),
  plantillaId: text("plantilla_id"),
  usuarioId: text("usuario_id").notNull(),
  fecha: text("fecha").notNull(),
  abiertoEn: text("abierto_en").notNull(),
  cerradoEn: text("cerrado_en"),
  aperturaCentimos: integer("apertura_centimos").notNull().default(0),
  efectivoEsperadoCentimos: integer("efectivo_esperado_centimos"),
  efectivoDeclaradoCentimos: integer("efectivo_declarado_centimos"),
  diferenciaCentimos: integer("diferencia_centimos"),
  justificacion: text("justificacion"),
  estado: text("estado", { enum: ["ABIERTO", "CERRADO"] }).notNull().default("ABIERTO"),
});

export const cashboxMovimientos = sqliteTable("cashbox_movimientos", {
  id: text("id").primaryKey(),
  turnoId: text("turno_id")
    .notNull()
    .references(() => cashboxTurnos.id),
  tipo: text("tipo", { enum: ["APERTURA", "VENTA", "INGRESO", "EGRESO", "VUELTO", "CIERRE"] }).notNull(),
  metodo: text("metodo", {
    enum: ["EFECTIVO", "YAPE", "PLIN", "LEMON", "AGORA", "TRANSFERENCIA", "POS_CREDITO", "POS_DEBITO"],
  }),
  montoCentimos: integer("monto_centimos").notNull(),
  ventaId: text("venta_id"),
  pagoId: text("pago_id"),
  vueltoCentimos: integer("vuelto_centimos"),
  motivo: text("motivo"),
  usuarioId: text("usuario_id").notNull(),
  ocurridoEn: text("ocurrido_en").notNull(),
});
