import type { Attribute, Category, FloorBoard } from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import { RoomIllustration } from "@casacarlos/ui";
import { Shell } from "./Shell.js";

interface Props {
  floor: FloorBoard;
  categories: Category[];
  attributes: Attribute[];
  preciosPorCategoria: Record<string, number>;
  onSelect: (cuartoId: string) => void;
  onCancel: () => void;
}

export function RoomScreen({ floor, categories, attributes, preciosPorCategoria, onSelect, onCancel }: Props) {
  const fanId = attributes.find((a) => a.nombre.toLowerCase().includes("ventilador"))?.id;
  const disponibles = floor.rooms.filter((r) => r.estado === "DISPONIBLE");

  return (
    <Shell title={floor.floor.nombre} step="Paso 2 de 3 — elige un cuarto" onBack={onCancel}>
      {disponibles.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-lg text-muted">
          Este piso ya no tiene cuartos disponibles. Vuelve a intentarlo.
        </div>
      ) : (
        <div className="stagger grid flex-1 grid-cols-2 gap-6 content-start">
          {disponibles.map((entry, i) => {
            const categoria = categories.find((c) => c.id === entry.room.categoriaId);
            const hasFan = fanId ? (categoria?.atributoIds.includes(fanId) ?? false) : false;
            const precio = preciosPorCategoria[entry.room.categoriaId];
            return (
              <button
                key={entry.room.id}
                style={{ ["--i" as string]: i }}
                onClick={() => onSelect(entry.room.id)}
                className="flex flex-col overflow-hidden rounded-3xl bg-surface text-left shadow-[var(--shadow-card)] ring-1 ring-line transition-all duration-200 active:scale-[0.98] hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
              >
                <div className="bg-inset p-3">
                  <div className="aspect-[220/130]">
                    <RoomIllustration beds={categoria?.camas ?? 1} hasFan={hasFan} floorFill="var(--room-floor-teal, #F5F1E8)" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-1 p-5">
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-2xl text-ink">Cuarto {entry.room.numero}</span>
                    {precio !== undefined && <span className="text-xl font-semibold text-brand">{format(cents(precio))}</span>}
                  </div>
                  <p className="text-sm font-medium text-muted">{categoria?.nombre}</p>
                  {categoria?.descripcion && <p className="text-sm text-subtle">{categoria.descripcion}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
