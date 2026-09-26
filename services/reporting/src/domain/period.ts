import type { DateRange } from "@casacarlos/contracts";

// El hotel opera en Perú todo el año (UTC-5, sin horario de verano). Los
// timestamps se guardan en UTC, pero los filtros y agrupaciones que ve caja
// tienen que respetar el día calendario de Lima: 00:00 local = 05:00 UTC.
const PERU_OFFSET_MS = 5 * 60 * 60 * 1000;

function isoDateParts(value: string): [number, number, number] {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Fecha inválida: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function utcDateForPeruMidnight(value: string): Date {
  const [year, month, day] = isoDateParts(value);
  return new Date(Date.UTC(year, month - 1, day, 5));
}

/** El periodo inmediatamente anterior, de la misma duración — base de toda comparativa (DAS-02/07). */
export function previousRange(range: DateRange): DateRange {
  const desde = utcDateForPeruMidnight(range.desde);
  const hasta = utcDateForPeruMidnight(range.hasta);
  const days = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1;

  const prevHasta = new Date(desde);
  prevHasta.setUTCDate(prevHasta.getUTCDate() - 1);
  const prevDesde = new Date(prevHasta);
  prevDesde.setUTCDate(prevDesde.getUTCDate() - (days - 1));

  return { desde: toIsoDate(prevDesde), hasta: toIsoDate(prevHasta) };
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Todas las fechas ISO del rango, límites inclusive. */
export function daysBetween(range: DateRange): string[] {
  const out: string[] = [];
  const cur = utcDateForPeruMidnight(range.desde);
  const end = utcDateForPeruMidnight(range.hasta);
  while (cur <= end) {
    out.push(toIsoDate(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** El rango como marcas de tiempo ISO completas — inicio del primer día a fin del último. */
export function rangeBounds(range: DateRange): { startIso: string; endIso: string } {
  const start = utcDateForPeruMidnight(range.desde);
  const end = utcDateForPeruMidnight(range.hasta);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setTime(end.getTime() - 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Devuelve la fecha y hora de negocio (Lima) para un timestamp UTC guardado. */
export function peruDateParts(iso: string): { fecha: string; diaSemana: number; hora: number } {
  const local = new Date(new Date(iso).getTime() - PERU_OFFSET_MS);
  return {
    fecha: local.toISOString().slice(0, 10),
    diaSemana: local.getUTCDay(),
    hora: local.getUTCHours(),
  };
}

export function pctChange(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}
