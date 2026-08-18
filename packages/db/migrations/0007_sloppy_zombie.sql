CREATE TABLE `cashbox_arqueos` (
	`id` text PRIMARY KEY NOT NULL,
	`turno_id` text NOT NULL,
	`denominaciones_json` text NOT NULL,
	`total_centimos` integer NOT NULL,
	`efectivo_esperado_centimos` integer NOT NULL,
	`diferencia_centimos` integer NOT NULL,
	`usuario_id` text NOT NULL,
	`creado_en` text NOT NULL,
	FOREIGN KEY (`turno_id`) REFERENCES `cashbox_turnos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `cashbox_turnos` ADD `denominaciones_cierre_json` text;