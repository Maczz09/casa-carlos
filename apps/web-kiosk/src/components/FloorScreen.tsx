import type { FloorBoard } from "@casacarlos/contracts";
import { Shell } from "./Shell.js";

interface Props {
  floors: FloorBoard[];
  onSelect: (pisoId: string) => void;
  onCancel: () => void;
}

export function FloorScreen({ floors, onSelect, onCancel }: Props) {
  return (
    <Shell title="Elige un piso" step="Paso 1 de 3" onBack={onCancel}>
      <div className="stagger flex flex-1 flex-col items-center justify-center gap-6">
        {floors.map((f, i) => {
          const disponibles = f.rooms.filter((r) => r.estado === "DISPONIBLE").length;
          const libre = disponibles > 0;
          return (
            <button
              key={f.floor.id}
              style={{ ["--i" as string]: i }}
              onClick={() => libre && onSelect(f.floor.id)}
              disabled={!libre}
              className={`flex w-full max-w-md items-center justify-between rounded-3xl bg-surface px-8 py-7 shadow-[var(--shadow-card)] ring-1 ring-line transition-all duration-200 active:scale-[0.98] ${
                libre ? "hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]" : "opacity-50"
              }`}
            >
              <span className="font-serif text-3xl text-ink">{f.floor.nombre}</span>
              <span className={`flex items-center gap-2 text-sm font-medium ${libre ? "text-brand" : "text-danger"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${libre ? "bg-brand" : "bg-danger"}`} />
                {libre ? `${disponibles} disponible${disponibles > 1 ? "s" : ""}` : "Completo"}
              </span>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}
