-- Repara las ventas cuyo total quedó desalineado de sus propias líneas.
--
-- Bug encontrado en la base real: una venta cobrando S/ 72.00 mostrando una
-- sola línea de S/ 60.00 en el comprobante. Causa: `cancelLine` marcaba la
-- línea como anulada (con lo cual desaparece del comprobante, porque
-- `listLines` filtra las anuladas) y recién DESPUÉS restaba del total; si algo
-- fallaba en el medio, el total seguía cobrando una línea que ya nadie ve.
-- De 19 anulaciones seguidas, 18 descontaron bien y una no.
--
-- El origen ya está corregido en services/sales/src/service.ts: el total ahora
-- se DERIVA de las líneas vigentes (`recalcularTotales`) en vez de irse sumando
-- y restando, así que no puede volver a separarse de lo que muestra el
-- comprobante. Esto solo arregla lo que ya quedó mal escrito.
--
-- El saldo se recalcula pero los pagos NO se tocan: si alguien pagó de más
-- por este bug, el saldo queda negativo a propósito — eso es plata que se le
-- debe devolver al huésped, y borrarlo escondería el problema en vez de
-- mostrarlo.

UPDATE sales_ventas
SET total_centimos = (
  SELECT COALESCE(SUM(l.subtotal_centimos), 0)
  FROM sales_lineas l
  WHERE l.venta_id = sales_ventas.id AND l.anulada = 0
)
WHERE total_centimos <> (
  SELECT COALESCE(SUM(l.subtotal_centimos), 0)
  FROM sales_lineas l
  WHERE l.venta_id = sales_ventas.id AND l.anulada = 0
);
--> statement-breakpoint
UPDATE sales_ventas
SET saldo_centimos = total_centimos - pagado_centimos
WHERE saldo_centimos <> total_centimos - pagado_centimos;
