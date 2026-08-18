import { sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Solo-append. Never UPDATE or DELETE this table — see REGLAS-DE-NEGOCIO.md §11.
 * Modifying a sale or stay is always allowed; this is how that stays safe.
 */
export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  entidad: text("entidad").notNull(),
  entidadId: text("entidad_id").notNull(),
  accion: text("accion").notNull(),
  usuarioId: text("usuario_id"),
  ocurridoEn: text("ocurrido_en").notNull(),
  antesJson: text("antes_json"),
  despuesJson: text("despues_json"),
  motivo: text("motivo"),
});
