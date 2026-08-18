CREATE TABLE `billing_comprobantes` (
	`id` text PRIMARY KEY NOT NULL,
	`venta_id` text NOT NULL,
	`tipo` text NOT NULL,
	`serie` text NOT NULL,
	`correlativo` integer NOT NULL,
	`receptor_tipo_doc` text NOT NULL,
	`receptor_numero_doc` text NOT NULL,
	`receptor_razon_social` text NOT NULL,
	`lineas_json` text NOT NULL,
	`valor_venta_centimos` integer NOT NULL,
	`igv_centimos` integer NOT NULL,
	`total_centimos` integer NOT NULL,
	`monto_letras` text NOT NULL,
	`estado_sunat` text NOT NULL,
	`sunat_codigo` text,
	`sunat_descripcion` text,
	`xml_base64` text,
	`cdr_base64` text,
	`usuario_id` text NOT NULL,
	`creado_en` text NOT NULL,
	`enviado_en` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ux_comprobante_serie` ON `billing_comprobantes` (`serie`,`correlativo`);--> statement-breakpoint
CREATE TABLE `billing_correlativos` (
	`serie` text PRIMARY KEY NOT NULL,
	`ultimo_correlativo` integer DEFAULT 0 NOT NULL
);
