import type { CashMovement } from "@casacarlos/contracts";

/**
 * The signed effect a movement has on the physical cash in the drawer.
 * Non-cash sale methods (Yape, tarjeta, transferencia…) never touch the
 * drawer, so they contribute zero here even though they're still recorded
 * for the per-method breakdown — see REGLAS-DE-NEGOCIO.md §9.
 */
export function cashEffect(movement: Pick<CashMovement, "tipo" | "metodo" | "montoCentimos">): number {
  switch (movement.tipo) {
    case "APERTURA":
    case "INGRESO":
      return movement.montoCentimos;
    case "EGRESO":
    case "VUELTO":
      return -movement.montoCentimos;
    case "VENTA":
      return movement.metodo === "EFECTIVO" ? movement.montoCentimos : 0;
    // Un ajuste corrige en cualquier dirección — el signo ya viene puesto en montoCentimos
    // (positivo = sumar al esperado, negativo = restar), a diferencia de ingreso/egreso donde
    // el signo lo determina el tipo, no el monto.
    case "AJUSTE":
      return movement.montoCentimos;
    case "CIERRE":
      return 0;
  }
}

export function expectedCash(movements: Pick<CashMovement, "tipo" | "metodo" | "montoCentimos">[]): number {
  return movements.reduce((total, m) => total + cashEffect(m), 0);
}

/** Por encima de esto, el cierre exige justificación escrita (CAJ-07). */
export const DIFFERENCE_THRESHOLD_CENTIMOS = 500;
