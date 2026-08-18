CREATE TABLE `inventory_categorias` (
	`id` text PRIMARY KEY NOT NULL,
	`nombre` text NOT NULL,
	`descripcion` text,
	`activo` integer DEFAULT true NOT NULL,
	`creado_en` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_categorias_nombre_unique` ON `inventory_categorias` (`nombre`);--> statement-breakpoint
ALTER TABLE `inventory_productos` ADD `categoria_id` text REFERENCES inventory_categorias(id);--> statement-breakpoint
-- Los pasos de datos van ANTES del DROP: la categoría era texto libre en cada
-- producto, así que primero se convierte cada valor distinto en una fila de
-- inventory_categorias y recién después se borra la columna vieja. Sin esto,
-- toda instalación existente perdería la categoría de sus productos.
INSERT INTO `inventory_categorias` (`id`, `nombre`, `descripcion`, `activo`, `creado_en`)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-a' || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
  trim(`categoria`),
  NULL,
  1,
  strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM `inventory_productos`
WHERE `categoria` IS NOT NULL AND trim(`categoria`) <> ''
GROUP BY trim(`categoria`);--> statement-breakpoint
UPDATE `inventory_productos`
SET `categoria_id` = (SELECT `c`.`id` FROM `inventory_categorias` `c` WHERE `c`.`nombre` = trim(`inventory_productos`.`categoria`))
WHERE `categoria` IS NOT NULL AND trim(`categoria`) <> '';--> statement-breakpoint
ALTER TABLE `inventory_productos` DROP COLUMN `categoria`;