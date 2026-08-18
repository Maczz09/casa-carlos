CREATE TABLE `billing_bajas` (
	`id` text PRIMARY KEY NOT NULL,
	`comprobante_id` text NOT NULL,
	`correlativo` integer NOT NULL,
	`motivo` text NOT NULL,
	`ticket` text,
	`estado_sunat` text NOT NULL,
	`sunat_codigo` text,
	`sunat_descripcion` text,
	`xml_base64` text,
	`cdr_base64` text,
	`usuario_id` text NOT NULL,
	`creado_en` text NOT NULL,
	`resuelto_en` text,
	FOREIGN KEY (`comprobante_id`) REFERENCES `billing_comprobantes`(`id`) ON UPDATE no action ON DELETE no action
);
