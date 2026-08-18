ALTER TABLE `rooms_categorias` ADD `ventiladores` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Backfill: antes el ventilador era solo presencia/ausencia (el atributo
-- "ventilador" asignado o no vía rooms_categoria_atributos). Las categorías
-- que ya lo tenían asignado pasan a ventiladores=1 para no cambiar cómo se
-- ven los cuartos existentes apenas se corre esta migración.
UPDATE `rooms_categorias` SET `ventiladores` = 1
WHERE `id` IN (
  SELECT `ca`.`categoria_id`
  FROM `rooms_categoria_atributos` `ca`
  JOIN `rooms_atributos` `a` ON `a`.`id` = `ca`.`atributo_id`
  WHERE lower(`a`.`nombre`) LIKE '%ventilador%'
);