/** Tasa de IGV vigente en Perú (18%). */
const IGV_RATE = 0.18;

export interface DesgloseIgv {
  valorVentaCentimos: number;
  igvCentimos: number;
}

/**
 * Los precios en Casa Carlos ya incluyen IGV (como en cualquier consumo en
 * Perú) — SUNAT exige declarar el valor de venta (base imponible) y el IGV
 * por separado. `igv` absorbe el céntimo de redondeo para que
 * `valorVenta + igv === totalCentimos` siempre cierre exacto.
 */
export function desglosarIgv(totalCentimos: number): DesgloseIgv {
  const valorVentaCentimos = Math.round(totalCentimos / (1 + IGV_RATE));
  const igvCentimos = totalCentimos - valorVentaCentimos;
  return { valorVentaCentimos, igvCentimos };
}
