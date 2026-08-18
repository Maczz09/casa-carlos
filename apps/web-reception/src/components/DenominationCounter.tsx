import { cents, format } from "@casacarlos/money";

interface Props {
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
}

/** Billetes/monedas de sol vigentes — la clave que se guarda es el valor en céntimos, como en todo el resto del sistema. */
const DENOMINACIONES = [
  { centimos: 20000, label: "S/ 200" },
  { centimos: 10000, label: "S/ 100" },
  { centimos: 5000, label: "S/ 50" },
  { centimos: 2000, label: "S/ 20" },
  { centimos: 1000, label: "S/ 10" },
  { centimos: 500, label: "S/ 5" },
  { centimos: 200, label: "S/ 2" },
  { centimos: 100, label: "S/ 1" },
  { centimos: 50, label: "S/ 0.50" },
  { centimos: 20, label: "S/ 0.20" },
  { centimos: 10, label: "S/ 0.10" },
];

export function sumDenominaciones(value: Record<string, number>): number {
  return Object.entries(value).reduce((total, [centimosStr, cantidad]) => total + Number(centimosStr) * cantidad, 0);
}

/** Conteo de caja billete por billete/moneda — mismo detalle que se guarda y se envía al backend. */
export function DenominationCounter({ value, onChange }: Props) {
  const total = sumDenominaciones(value);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-raised p-3">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {DENOMINACIONES.map((d) => {
          const count = value[String(d.centimos)] ?? 0;
          return (
            <label key={d.centimos} className="flex items-center justify-between gap-2 text-sm">
              <span className={count > 0 ? "font-medium text-ink" : "text-muted"}>{d.label}</span>
              <input
                type="number"
                min={0}
                value={value[String(d.centimos)] ?? ""}
                onChange={(e) => onChange({ ...value, [String(d.centimos)]: Math.max(0, Number(e.target.value) || 0) })}
                className="w-16 rounded-lg border border-line bg-surface px-2 py-1 text-right text-ink transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
              />
            </label>
          );
        })}
      </div>
      <div className="flex justify-between border-t border-line pt-2 text-sm font-semibold">
        <span className="text-muted">Total contado</span>
        <span className="tabular-nums text-ink">{format(cents(total))}</span>
      </div>
    </div>
  );
}
