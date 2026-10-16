ALTER TABLE cashbox_turnos ADD COLUMN programado_hasta text;
--> statement-breakpoint
ALTER TABLE cashbox_turnos ADD COLUMN tipo_cierre text;
--> statement-breakpoint
ALTER TABLE cashbox_turnos ADD COLUMN turno_anterior_id text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cashbox_configuracion (id text PRIMARY KEY NOT NULL, automatico integer DEFAULT 1 NOT NULL, turno_activo_id text REFERENCES cashbox_turnos(id));
--> statement-breakpoint
-- Referencia única y reversible a la caja compartida. No se modifica ni cierra
-- ningún turno existente ni se transfieren sus importes durante la migración.
-- Los demás turnos abiertos se muestran como legados pendientes de conciliar.
INSERT OR IGNORE INTO cashbox_configuracion (id, automatico, turno_activo_id)
VALUES ('principal', 1, (SELECT id FROM cashbox_turnos WHERE estado = 'ABIERTO' ORDER BY abierto_en DESC, id DESC LIMIT 1));
