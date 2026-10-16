import type { ShiftTemplate } from "@casacarlos/contracts";

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const validTime = (time: string) => TIME.test(time);
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

/** Un relevo necesita cobertura continua y sin solapamientos, incluida medianoche. */
export function scheduleProblem(templates: ShiftTemplate[]): string | null {
  if (!templates.length) return "Configura los horarios para activar los relevos automáticos.";
  const coverage = new Uint8Array(1440);
  for (const t of templates) {
    if (!validTime(t.horaInicio) || !validTime(t.horaFin) || t.horaInicio === t.horaFin) return "Cada turno debe tener horas válidas y distintas.";
    const start = minutes(t.horaInicio), duration = (minutes(t.horaFin) - start + 1440) % 1440;
    for (let m = 0; m < duration; m++) {
      const index = (start + m) % 1440;
      if (coverage[index]) return "Hay horarios superpuestos. Corrígelos para reanudar los relevos automáticos.";
      coverage[index] = 1;
    }
  }
  return coverage.some(value => !value) ? "Los horarios deben cubrir las 24 horas sin espacios para activar los relevos automáticos." : null;
}

export function scheduledPeriod(templates: ShiftTemplate[], now: Date) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const midnight = new Date(`${date}T00:00:00-05:00`).getTime();
  const minute = Math.floor((now.getTime() - midnight) / 60_000);
  const template = templates.find(t => {
    const start = minutes(t.horaInicio), end = minutes(t.horaFin);
    return end > start ? minute >= start && minute < end : minute >= start || minute < end;
  });
  if (!template) throw new Error("No hay un horario de caja para esta hora.");
  const start = minutes(template.horaInicio), duration = (minutes(template.horaFin) - start + 1440) % 1440;
  const startedAt = midnight + start * 60_000 - (minute < start ? 86_400_000 : 0);
  return { template, start: new Date(startedAt), end: new Date(startedAt + duration * 60_000) };
}
