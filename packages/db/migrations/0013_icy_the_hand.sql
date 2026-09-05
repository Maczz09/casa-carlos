ALTER TABLE `payments_cuentas_cobro` ADD `metodo` text DEFAULT 'TRANSFERENCIA' NOT NULL;--> statement-breakpoint
ALTER TABLE `payments_cuentas_cobro` ADD `telefono` text;--> statement-breakpoint
ALTER TABLE `payments_cuentas_cobro` ADD `notas` text;--> statement-breakpoint
ALTER TABLE `payments_cuentas_cobro` ADD `qr_archivo` text;--> statement-breakpoint
ALTER TABLE `payments_cuentas_cobro` ADD `qr_mime_type` text;;--> statement-breakpoint
-- Backfill: hasta ahora el método de un canal de cobro estaba implícito en su
-- tipo y su proveedor. Las billeteras que ya existían pasan a cobrar con su
-- propio método (YAPE/PLIN/LEMON/AGORA) y las cuentas bancarias se quedan con
-- el DEFAULT 'TRANSFERENCIA' de la columna nueva.
UPDATE `payments_cuentas_cobro`
SET `metodo` = upper(trim(`proveedor`))
WHERE `tipo` = 'BILLETERA' AND upper(trim(`proveedor`)) IN ('YAPE', 'PLIN', 'LEMON', 'AGORA');--> statement-breakpoint
UPDATE `payments_cuentas_cobro` SET `metodo` = 'TRANSFERENCIA' WHERE `tipo` = 'BANCO';
