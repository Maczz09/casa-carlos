import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const identityUsuarios = sqliteTable("identity_usuarios", {
  id: text("id").primaryKey(),
  usuario: text("usuario").notNull().unique(),
  nombres: text("nombres").notNull(),
  apellidos: text("apellidos").notNull(),
  passwordHash: text("password_hash").notNull(),
  pinHash: text("pin_hash"),
  rol: text("rol", { enum: ["ADMIN", "RECEPCIONISTA"] }).notNull(),
  telefonoWhatsapp: text("telefono_whatsapp"),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  creadoEn: text("creado_en").notNull(),
});

export const identitySesiones = sqliteTable("identity_sesiones", {
  id: text("id").primaryKey(),
  usuarioId: text("usuario_id")
    .notNull()
    .references(() => identityUsuarios.id),
  tokenHash: text("token_hash").notNull(),
  iniciadaEn: text("iniciada_en").notNull(),
  expiraEn: text("expira_en").notNull(),
  cerradaEn: text("cerrada_en"),
});
