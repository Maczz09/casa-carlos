import type { Modality } from "@casacarlos/contracts";

/** Recovers how many 3h blocks a walk-in stay covers from its own timestamps — never re-derived from "now". */
export function computeBlocks(modality: Modality, checkinPrevisto: string, checkoutPrevisto: string): number {
  const ms = new Date(checkoutPrevisto).getTime() - new Date(checkinPrevisto).getTime();
  const hours = ms / 3_600_000;
  return Math.max(1, Math.round(hours / modality.duracionHoras));
}
