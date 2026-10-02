ALTER TABLE `pricing_modalidades` ADD `precio_adicional_centimos` integer DEFAULT 1000 NOT NULL;
--> statement-breakpoint
ALTER TABLE `pricing_modalidades` ADD `tiempo_adicional_min` integer DEFAULT 60 NOT NULL;
