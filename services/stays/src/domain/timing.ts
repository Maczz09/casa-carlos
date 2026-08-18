import type { Modality } from "@casacarlos/contracts";

export interface StayWindow {
  checkinPrevisto: Date;
  checkoutPrevisto: Date;
  bloqueoDesde: Date;
  bloqueoHasta: Date;
}

function atTime(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Bloque de horas (modalidad HORAS_3): sólo bloquea su propia ventana, no el día completo. */
export function hoursWindow(modality: Modality, checkinReal: Date, bloques: number): StayWindow {
  const totalHoras = modality.duracionHoras * bloques;
  const checkoutPrevisto = new Date(checkinReal.getTime() + totalHoras * 60 * 60_000);
  return { checkinPrevisto: checkinReal, checkoutPrevisto, bloqueoDesde: checkinReal, bloqueoHasta: checkoutPrevisto };
}

/**
 * Modalidad de noche (checkin/checkout a hora fija). El cuarto queda
 * bloqueado el día completo — ver REGLAS-DE-NEGOCIO.md §6 — sin importar a
 * qué hora real llega el cliente.
 */
export function nightWindow(modality: Modality, referenceDate: Date, noches: number): StayWindow {
  if (!modality.checkinFijo || !modality.checkoutFijo) {
    throw new Error(`La modalidad ${modality.codigo} no tiene horarios de check-in/checkout fijos.`);
  }
  const checkinPrevisto = atTime(referenceDate, modality.checkinFijo);
  const [ch, cm] = modality.checkinFijo.split(":").map(Number);
  const [oh, om] = modality.checkoutFijo.split(":").map(Number);
  const crossesMidnight = (oh ?? 0) * 60 + (om ?? 0) <= (ch ?? 0) * 60 + (cm ?? 0);

  let checkoutBase = atTime(checkinPrevisto, modality.checkoutFijo);
  if (crossesMidnight) checkoutBase = addDays(checkoutBase, 1);
  const checkoutPrevisto = addDays(checkoutBase, noches - 1);

  return {
    checkinPrevisto,
    checkoutPrevisto,
    bloqueoDesde: startOfDay(checkinPrevisto),
    bloqueoHasta: checkoutPrevisto,
  };
}

export function toleranceDeadline(checkoutPrevisto: Date, toleranciaMin: number): Date {
  return new Date(checkoutPrevisto.getTime() + toleranciaMin * 60_000);
}

/** Half-open interval overlap: [aFrom, aTo) intersects [bFrom, bTo). */
export function windowsOverlap(aFrom: Date, aTo: Date, bFrom: Date, bTo: Date): boolean {
  return aFrom < bTo && bFrom < aTo;
}
