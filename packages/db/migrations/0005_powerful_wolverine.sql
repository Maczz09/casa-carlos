ALTER TABLE `billing_comprobantes` ADD `comprobante_afectado_id` text REFERENCES billing_comprobantes(id);--> statement-breakpoint
ALTER TABLE `billing_comprobantes` ADD `motivo_codigo` text;--> statement-breakpoint
ALTER TABLE `billing_comprobantes` ADD `motivo_descripcion` text;