CREATE TABLE `inventory_producto_imagenes` (
	`id` text PRIMARY KEY NOT NULL,
	`producto_id` text NOT NULL,
	`archivo` text NOT NULL,
	`mime_type` text NOT NULL,
	`tamano_bytes` integer NOT NULL,
	`orden` integer NOT NULL,
	`creado_en` text NOT NULL,
	`creado_por` text NOT NULL,
	FOREIGN KEY (`producto_id`) REFERENCES `inventory_productos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_producto_imagenes_archivo_unique` ON `inventory_producto_imagenes` (`archivo`);