import type { Category, FloorBoard } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { RoomIllustration } from "@casacarlos/ui";
import { Shell } from "./Shell.js";

interface Props {
  floor: FloorBoard;
  categories: Category[];
  preciosPorCategoria: Record<string, number>;
  onSelect: (cuartoId: string) => void;
  onCancel: () => void;
}

export function RoomScreen({ floor, categories, preciosPorCategoria, onSelect, onCancel }: Props) {
  const disponibles = floor.rooms.filter((r) => r.estado === "DISPONIBLE");

  return (
    <Shell title={floor.floor.nombre} step="Paso 2 de 3 — elige un cuarto" onBack={onCancel}>
      {disponibles.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-lg text-muted">
          Este piso ya no tiene cuartos disponibles. Vuelve a intentarlo.
        </div>
      ) : (
        <div className="stagger grid flex-1 grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
          {disponibles.map((entry, i) => {
            const categoria = categories.find((c) => c.id === entry.room.categoriaId);
            const precio = preciosPorCategoria[entry.room.categoriaId];
            return (
              <button
                key={entry.room.id}
                style={{ ["--i" as string]: i }}
                onClick={() => onSelect(entry.room.id)}
                className="flex flex-col overflow-hidden rounded-2xl bg-surface text-left shadow-[var(--shadow-card)] ring-1 ring-line transition-all duration-200 active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
              >
                <div className="bg-inset p-2">
                  <div className="aspect-[220/100]">
                    <RoomIllustration beds={categoria?.camas ?? 1} fans={categoria?.ventiladores ?? 0} floorFill="var(--room-floor-teal, #F5F1E8)" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-0.5 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-lg font-bold text-ink">Cuarto {entry.room.numero}</span>
                    {precio !== undefined && <span className="text-base font-semibold text-brand">{format(cents(precio))}</span>}
                  </div>
                  <p className="text-xs font-medium text-muted truncate">{categoria?.nombre}</p>
                  {categoria?.descripcion && <p className="text-xs text-subtle line-clamp-1">{categoria.descripcion}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
