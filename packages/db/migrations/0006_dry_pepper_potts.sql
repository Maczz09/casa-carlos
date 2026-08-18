CREATE TABLE `billing_comprobantes_pago` (
	`id` text PRIMARY KEY NOT NULL,
	`venta_id` text NOT NULL,
	`tipo` text NOT NULL,
	`receptor_ruc` text,
	`receptor_razon_social` text,
	`estado` text NOT NULL,
	`comprobante_id` text,
	`usuario_id` text NOT NULL,
	`creado_en` text NOT NULL,
	`emitido_en` text,
	FOREIGN KEY (`comprobante_id`) REFERENCES `billing_comprobantes`(`id`) ON UPDATE no action ON DELETE no action
);
