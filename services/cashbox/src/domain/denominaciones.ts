import type { Denominaciones } from "@casacarlos/contracts";

/** Suma un conteo por denominación (clave = valor en céntimos, valor = cuántos hay) al total real en céntimos. */
export function sumDenominaciones(denominaciones: Denominaciones): number {
  return Object.entries(denominaciones).reduce((total, [centimosStr, cantidad]) => total + Number(centimosStr) * cantidad, 0);
}
