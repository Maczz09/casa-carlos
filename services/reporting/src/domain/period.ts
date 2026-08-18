import type { DateRange } from "@casacarlos/contracts";

/** El periodo inmediatamente anterior, de la misma duración — base de toda comparativa (DAS-02/07). */
export function previousRange(range: DateRange): DateRange {
  const desde = new Date(`${range.desde}T00:00:00`);
  const hasta = new Date(`${range.hasta}T00:00:00`);
  const days = Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1;

  const prevHasta = new Date(desde);
  prevHasta.setDate(prevHasta.getDate() - 1);
  const prevDesde = new Date(prevHasta);
  prevDesde.setDate(prevDesde.getDate() - (days - 1));

  return { desde: toIsoDate(prevDesde), hasta: toIsoDate(prevHasta) };
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Todas las fechas ISO del rango, límites inclusive. */
export function daysBetween(range: DateRange): string[] {
  const out: string[] = [];
  const cur = new Date(`${range.desde}T00:00:00`);
  const end = new Date(`${range.hasta}T00:00:00`);
  while (cur <= end) {
    out.push(toIsoDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** El rango como marcas de tiempo ISO completas — inicio del primer día a fin del último. */
export function rangeBounds(range: DateRange): { startIso: string; endIso: string } {
  return { startIso: `${range.desde}T00:00:00.000Z`, endIso: `${range.hasta}T23:59:59.999Z` };
}

export function pctChange(actual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}
