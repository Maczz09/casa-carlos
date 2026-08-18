ALTER TABLE `stays_estadias` ADD `cliente_nombres` text;--> statement-breakpoint
ALTER TABLE `stays_estadias` ADD `cliente_apellidos` text;--> statement-breakpoint
ALTER TABLE `stays_estadias` ADD `cliente_dni` text;--> statement-breakpoint
ALTER TABLE `stays_estadias` ADD `cliente_telefono` text;--> statement-breakpoint
-- Backfill: las estadías que ya existían no tenían foto propia del cliente,
-- solo el join en vivo a stays_clientes — se copia una vez para no dejarlas
-- en blanco. De acá en adelante cada check-in/reserva graba la suya.
UPDATE `stays_estadias` SET
  `cliente_nombres` = (SELECT `nombres` FROM `stays_clientes` WHERE `stays_clientes`.`id` = `stays_estadias`.`cliente_id`),
  `cliente_apellidos` = (SELECT `apellidos` FROM `stays_clientes` WHERE `stays_clientes`.`id` = `stays_estadias`.`cliente_id`),
  `cliente_dni` = (SELECT `dni` FROM `stays_clientes` WHERE `stays_clientes`.`id` = `stays_estadias`.`cliente_id`),
  `cliente_telefono` = (SELECT `telefono` FROM `stays_clientes` WHERE `stays_clientes`.`id` = `stays_estadias`.`cliente_id`);--> statement-breakpoint
-- Corrección de dato: la modalidad de check-in 14:00 quedó sembrada como
-- "Noche" por error — es la de día (hasta las 10am del día siguiente). El
-- fix en seed.ts solo aplica a una base de datos nueva/vacía, así que esta
-- base ya sembrada necesita la corrección explícita acá.
UPDATE `pricing_modalidades` SET `nombre` = 'Día — check-in 14:00' WHERE `codigo` = 'NOCHE_A' AND `nombre` = 'Noche — check-in 14:00';