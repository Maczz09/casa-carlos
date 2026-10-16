ALTER TABLE sales_lineas ADD intervalo_minutos integer;
--> statement-breakpoint
-- Las horas cargadas manualmente no son el recargo automático del temporizador.
UPDATE sales_lineas SET referencia_id = 'HORA_EXTRA_MANUAL'
WHERE referencia_id = 'EXCESO_TIEMPO' AND descripcion LIKE 'Hora(s) extra%';
--> statement-breakpoint
-- Conserva el intervalo histórico donde quedó escrito en la descripción anterior.
UPDATE sales_lineas SET intervalo_minutos = CASE
 WHEN descripcion LIKE '%30 min%' THEN 30 WHEN descripcion LIKE '%15 min%' THEN 15
 WHEN descripcion LIKE '%45 min%' THEN 45 WHEN descripcion LIKE '%1h%' THEN 60
 ELSE (SELECT tiempo_adicional_min FROM pricing_modalidades m JOIN stays_estadias s ON s.modalidad_id = m.id JOIN sales_ventas v ON v.estadia_id = s.id WHERE v.id = sales_lineas.venta_id)
END WHERE referencia_id = 'EXCESO_TIEMPO';
--> statement-breakpoint
-- Repara únicamente ventas finalizadas sin saldo; no cambia importes ni movimientos.
INSERT INTO audit_log (id, entidad, entidad_id, accion, usuario_id, ocurrido_en, antes_json, despues_json, motivo)
SELECT 'repair_checkout_' || v.id, 'sales_ventas', v.id, 'REPARAR_CIERRE_CHECKOUT', NULL,
 strftime('%Y-%m-%dT%H:%M:%fZ','now'), json_object('estado',v.estado), json_object('estado','CERRADA','cerradaEn',s.checkout_real), 'Actualización: estadía finalizada con saldo cero'
FROM sales_ventas v JOIN stays_estadias s ON s.id = v.estadia_id
WHERE s.estado = 'FINALIZADA' AND s.checkout_real IS NOT NULL AND v.estado NOT IN ('CERRADA','ANULADA') AND v.saldo_centimos = 0;
--> statement-breakpoint
UPDATE sales_ventas SET estado = 'CERRADA', cerrada_en = (SELECT checkout_real FROM stays_estadias WHERE id = sales_ventas.estadia_id)
WHERE estado NOT IN ('CERRADA','ANULADA') AND saldo_centimos = 0 AND estadia_id IN (SELECT id FROM stays_estadias WHERE estado = 'FINALIZADA' AND checkout_real IS NOT NULL);
