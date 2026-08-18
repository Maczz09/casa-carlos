import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const notificationsDestinatarios = sqliteTable("notifications_destinatarios", {
  id: text("id").primaryKey(),
  usuarioId: text("usuario_id"),
  nombre: text("nombre").notNull(),
  telefono: text("telefono").notNull(),
  eventos: text("eventos").notNull(), // JSON string[]
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
});

export const notificationsPlantillas = sqliteTable("notifications_plantillas", {
  id: text("id").primaryKey(),
  codigo: text("codigo", { enum: ["STAY_OVERSTAYED", "LOW_STOCK", "SHIFT_DIFFERENCE"] }).notNull().unique(),
  canal: text("canal", { enum: ["WHATSAPP"] }).notNull().default("WHATSAPP"),
  cuerpo: text("cuerpo").notNull(),
  activa: integer("activa", { mode: "boolean" }).notNull().default(true),
});

export const notificationsCola = sqliteTable("notifications_cola", {
  id: text("id").primaryKey(),
  codigo: text("codigo", { enum: ["STAY_OVERSTAYED", "LOW_STOCK", "SHIFT_DIFFERENCE"] }).notNull(),
  canal: text("canal", { enum: ["WHATSAPP"] }).notNull().default("WHATSAPP"),
  destinatario: text("destinatario").notNull(),
  destinatarioNombre: text("destinatario_nombre").notNull(),
  mensaje: text("mensaje").notNull(),
  estado: text("estado", { enum: ["PENDIENTE", "ENVIADO", "FALLIDO"] }).notNull().default("PENDIENTE"),
  intentos: integer("intentos").notNull().default(0),
  ultimoError: text("ultimo_error"),
  creadoEn: text("creado_en").notNull(),
  enviadoEn: text("enviado_en"),
});
