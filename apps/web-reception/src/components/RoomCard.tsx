import type { RoomBoardEntry } from "@casacarlos/contracts";
import { IconBroom, RoomIllustration, STATUS_STYLE } from "@casacarlos/ui";
import { api } from "../api.js";
import { formatDuration, useCountdown } from "../hooks/useCountdown.js";

interface Props {
  entry: RoomBoardEntry;
  beds: number;
  hasFan: boolean;
  onClick: (entry: RoomBoardEntry) => void;
}

export function RoomCard({ entry, beds, hasFan, onClick }: Props) {
  const style = STATUS_STYLE[entry.estado];
  const Icon = style.icon;
  const showsCountdown = entry.estado === "OCUPADO" || entry.estado === "EN_TOLERANCIA" || entry.estado === "EXCEDIDO";
  const remaining = useCountdown(showsCountdown ? entry.desocupaEn : null);
  const clickable = entry.estado !== "FUERA_DE_SERVICIO";

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white shadow-md shadow-stone-900/5 ring-1 ring-stone-900/5 transition hover:shadow-lg hover:shadow-stone-900/10">
      <div className="h-1.5 w-full" style={{ background: style.accent }} />

      <button
        type="button"
        onClick={() => clickable && onClick(entry)}
        disabled={!clickable}
        className="block w-full text-left disabled:cursor-default"
      >
        <div className="relative bg-stone-100/70 p-2">
          <div className="aspect-[220/130]">
            <RoomIllustration beds={beds} hasFan={hasFan} floorFill={style.floorFill} muted={style.muted} />
          </div>

          <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2 py-0.5 text-lg font-bold tabular-nums text-stone-800 shadow-sm">
            {entry.room.numero}
          </span>

          <span
            className={`absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${style.badgeBg} ${style.badgeText} ${style.pulse ? "animate-pulse" : ""}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {style.label}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 px-3 py-2.5">
          {entry.clienteNombre ? (
            <>
              <p className="truncate text-sm font-medium text-stone-800">{entry.clienteNombre}</p>
              {remaining !== null && (
                <p className={`font-mono text-sm tabular-nums ${remaining < 0 ? "text-rose-600" : "text-stone-500"}`}>
                  {remaining < 0 ? "Excedido +" : ""}
                  {formatDuration(remaining)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-stone-400">
              {beds} cama{beds > 1 ? "s" : ""} · {hasFan ? "con ventilador" : "sin ventilador"}
            </p>
          )}
        </div>
      </button>

      {entry.estado === "DISPONIBLE" && (
        <button
          type="button"
          title="Marcar en limpieza"
          onClick={() => void api.markCleaning(entry.room.id)}
          className="absolute bottom-2.5 right-2.5 rounded-full bg-white p-1.5 text-stone-400 shadow-sm ring-1 ring-stone-900/5 transition hover:text-sky-600"
        >
          <IconBroom className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
