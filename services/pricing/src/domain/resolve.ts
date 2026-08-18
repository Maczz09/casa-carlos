import type { RateBand, Season } from "@casacarlos/contracts";

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Highest-`prioridad` season whose `[desde, hasta]` covers the date. Overlaps resolve by priority, not by recency. */
export function resolveSeason(seasons: Season[], at: Date): Season {
  const dateStr = at.toISOString().slice(0, 10);
  const candidates = seasons
    .filter((s) => s.activa && s.desde <= dateStr && dateStr <= s.hasta)
    .sort((a, b) => b.prioridad - a.prioridad);
  const season = candidates[0];
  if (!season) throw new Error(`No hay temporada activa para la fecha ${dateStr}.`);
  return season;
}

/**
 * The band whose `horaInicio` is the latest one at-or-before the current
 * time — with wraparound past midnight. Bands 10:00 / 16:00 / 23:00 at 08:00
 * resolve to the 23:00 band from the *previous* day, not the 10:00 band:
 * see REGLAS-DE-NEGOCIO.md §3 for why this is the case that always breaks.
 */
export function resolveBand(bands: RateBand[], at: Date): RateBand {
  if (bands.length === 0) throw new Error("La temporada no tiene franjas horarias configuradas.");
  const sorted = [...bands].sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));
  const nowMinutes = at.getHours() * 60 + at.getMinutes();

  let selected = sorted[sorted.length - 1]!; // default: wraparound to the last band of the previous day
  for (const band of sorted) {
    if (timeToMinutes(band.horaInicio) <= nowMinutes) {
      selected = band;
    } else {
      break;
    }
  }
  return selected;
}
