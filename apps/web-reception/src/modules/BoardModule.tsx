import { useMemo, useState } from "react";
import type { Attribute, Category, FloorBoard, RoomBoardEntry, RoomStatus } from "@casacarlos/contracts";
import { IconPlus, STATUS_STYLE } from "@casacarlos/ui";
import { RoomCard } from "../components/RoomCard.js";
import { Button, Card, EmptyState, PageHeader, Skeleton, cx } from "../components/ui.js";

interface Props {
  floors: FloorBoard[];
  categories: Category[];
  attributes: Attribute[];
  onSelectRoom: (entry: RoomBoardEntry) => void;
  onNewSale: () => void;
}

const LEGEND_ORDER: RoomStatus[] = ["DISPONIBLE", "RESERVADO", "OCUPADO", "EN_TOLERANCIA", "EXCEDIDO", "LIMPIEZA", "FUERA_DE_SERVICIO"];

export function BoardModule({ floors, categories, attributes, onSelectRoom, onNewSale }: Props) {
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);

  const fanAttributeId = useMemo(() => attributes.find((a) => a.nombre.toLowerCase().includes("ventilador"))?.id, [attributes]);
  const categoriesById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const active = floors.find((f) => f.floor.id === activeFloorId) ?? floors[0];

  const counts = useMemo(() => {
    const all = floors.flatMap((f) => f.rooms);
    return {
      total: all.length,
      disponibles: all.filter((r) => r.estado === "DISPONIBLE").length,
      ocupados: all.filter((r) => r.estado === "OCUPADO" || r.estado === "EN_TOLERANCIA" || r.estado === "EXCEDIDO").length,
      atencion: all.filter((r) => r.estado === "EXCEDIDO" || r.estado === "EN_TOLERANCIA").length,
    };
  }, [floors]);

  if (floors.length === 0) {
    return (
      <>
        <PageHeader title="Tablero de cuartos" subtitle="Cargando el estado de los cuartos…" />
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tablero de cuartos"
        subtitle={`${counts.disponibles} disponibles · ${counts.ocupados} ocupados de ${counts.total}${counts.atencion > 0 ? ` · ${counts.atencion} requieren atención` : ""}`}
        actions={
          <Button variant="primary" size="lg" icon={<IconPlus className="h-4 w-4" />} onClick={onNewSale}>
            Nueva venta
          </Button>
        }
      />

      <Card className="mb-5 flex flex-wrap items-center justify-between gap-4 p-3">
        <div className="flex flex-wrap gap-2">
          {floors.map((f) => {
            const isActive = (active?.floor.id ?? floors[0]?.floor.id) === f.floor.id;
            return (
              <button
                key={f.floor.id}
                onClick={() => setActiveFloorId(f.floor.id)}
                className={cx(
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95",
                  isActive ? "bg-brand-soft text-brand shadow-sm" : "text-muted hover:bg-inset hover:text-ink",
                )}
              >
                <span className={cx("h-2.5 w-2.5 rounded-full", f.semaforo === "VERDE" ? "bg-ok" : "bg-danger")} />
                {f.floor.nombre}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
          {LEGEND_ORDER.map((status) => {
            const style = STATUS_STYLE[status];
            return (
              <span key={status} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: style.accent }} />
                {style.label}
              </span>
            );
          })}
        </div>
      </Card>

      {active && active.rooms.length === 0 ? (
        <Card>
          <EmptyState title="Este piso no tiene cuartos" hint="Configurá los cuartos del piso para verlos en el tablero." />
        </Card>
      ) : (
        <div key={active?.floor.id} className="stagger grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {active?.rooms.map((entry, i) => {
            const category = categoriesById.get(entry.room.categoriaId);
            const beds = category?.camas ?? 1;
            const hasFan = fanAttributeId ? (category?.atributoIds.includes(fanAttributeId) ?? false) : false;
            return (
              <div key={entry.room.id} style={{ ["--i" as string]: i }}>
                <RoomCard entry={entry} beds={beds} hasFan={hasFan} onClick={onSelectRoom} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
