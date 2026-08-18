import { useMemo, useState } from "react";
import type { Attribute, Category, FloorBoard, RoomBoardEntry, RoomStatus } from "@casacarlos/contracts";
import { STATUS_STYLE } from "@casacarlos/ui";
import { RoomCard } from "./RoomCard.js";

interface Props {
  floors: FloorBoard[];
  categories: Category[];
  attributes: Attribute[];
  onSelectRoom: (entry: RoomBoardEntry) => void;
}

const LEGEND_ORDER: RoomStatus[] = ["DISPONIBLE", "RESERVADO", "OCUPADO", "EN_TOLERANCIA", "EXCEDIDO", "LIMPIEZA", "FUERA_DE_SERVICIO"];

export function Board({ floors, categories, attributes, onSelectRoom }: Props) {
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);

  const fanAttributeId = useMemo(() => attributes.find((a) => a.nombre.toLowerCase().includes("ventilador"))?.id, [attributes]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const active = floors.find((f) => f.floor.id === activeFloorId) ?? floors[0];

  if (floors.length === 0) {
    return <p className="p-8 text-slate-400">Cargando cuartos…</p>;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-3">
          {floors.map((f) => (
            <button
              key={f.floor.id}
              onClick={() => setActiveFloorId(f.floor.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                (active?.floor.id ?? floors[0]?.floor.id) === f.floor.id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${f.semaforo === "VERDE" ? "bg-emerald-400" : "bg-rose-500"}`} />
              {f.floor.nombre}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {LEGEND_ORDER.map((status) => {
            const style = STATUS_STYLE[status];
            return (
              <span key={status} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="h-2 w-2 rounded-full" style={{ background: style.accent }} />
                {style.label}
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {active?.rooms.map((entry) => {
          const category = categoriesById.get(entry.room.categoriaId);
          const beds = category?.camas ?? 1;
          const hasFan = fanAttributeId ? (category?.atributoIds.includes(fanAttributeId) ?? false) : false;
          return <RoomCard key={entry.room.id} entry={entry} beds={beds} hasFan={hasFan} onClick={onSelectRoom} />;
        })}
      </div>
    </div>
  );
}
