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
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        {floors.map((f) => {
          const disponibles = f.rooms.filter((r) => r.estado === "DISPONIBLE").length;
          const libre = disponibles > 0;
          return (
            <button
              key={f.floor.id}
              onClick={() => libre && onSelect(f.floor.id)}
              disabled={!libre}
              className={`flex w-full max-w-md items-center justify-between rounded-3xl bg-white px-8 py-7 shadow-md ring-1 ring-stone-900/5 transition active:scale-[0.98] ${
                libre ? "" : "opacity-50"
              }`}
            >
              <span className="font-serif text-3xl text-stone-800">{f.floor.nombre}</span>
              <span className={`flex items-center gap-2 text-sm font-medium ${libre ? "text-teal-700" : "text-rose-600"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${libre ? "bg-teal-500" : "bg-rose-500"}`} />
                {libre ? `${disponibles} disponible${disponibles > 1 ? "s" : ""}` : "Completo"}
              </span>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}
