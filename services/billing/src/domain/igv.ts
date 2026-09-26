import { cents, splitIncludedIgv } from "@casacarlos/money";

export interface DesgloseIgv {
  valorVentaCentimos: number;
  igvCentimos: number;
}

/**
 * Los precios en Hospedaje Carlos ya incluyen IGV (como en cualquier consumo en
 * Perú) — SUNAT exige declarar el valor de venta (base imponible) y el IGV
 * por separado. `igv` absorbe el céntimo de redondeo para que
 * `valorVenta + igv === totalCentimos` siempre cierre exacto.
 */
export function desglosarIgv(totalCentimos: number): DesgloseIgv {
  const { valorVenta, igv } = splitIncludedIgv(cents(totalCentimos));
  return { valorVentaCentimos: valorVenta, igvCentimos: igv };
}
