// Validación contra los catálogos SUNAT 09/10 — las listas en sí viven en
// @casacarlos/contracts (MOTIVOS_NOTA_CREDITO/MOTIVOS_NOTA_DEBITO) porque el
// frontend también las necesita para su selector; una sola fuente evita que
// backend y frontend se desincronicen sobre qué códigos son válidos.

import { MOTIVOS_NOTA_CREDITO, MOTIVOS_NOTA_DEBITO } from "@casacarlos/contracts";

const CODIGOS_NOTA_CREDITO = new Set(MOTIVOS_NOTA_CREDITO.map((m) => m.codigo));
const CODIGOS_NOTA_DEBITO = new Set(MOTIVOS_NOTA_DEBITO.map((m) => m.codigo));

export function esMotivoNotaCreditoValido(codigo: string): boolean {
  return CODIGOS_NOTA_CREDITO.has(codigo);
}

export function esMotivoNotaDebitoValido(codigo: string): boolean {
  return CODIGOS_NOTA_DEBITO.has(codigo);
}
