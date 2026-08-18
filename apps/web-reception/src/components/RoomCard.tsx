import type { RoomBoardEntry } from "@casacarlos/contracts";
import { IconBroom, RoomIllustration, STATUS_STYLE } from "@casacarlos/ui";
import { api } from "../api.js";
import { formatDuration, useCountdown } from "../hooks/useCountdown.js";
import { cx } from "./ui.js";

interface Props {
  entry: RoomBoardEntry;
  beds: number;
  fans: number;
  onClick: (entry: RoomBoardEntry) => void;
}

export function RoomCard({ entry, beds, fans, onClick }: Props) {
  const style = STATUS_STYLE[entry.estado];
  const Icon = style.icon;
  const showsCountdown = entry.estado === "OCUPADO" || entry.estado === "EN_TOLERANCIA" || entry.estado === "EXCEDIDO";
  const remaining = useCountdown(showsCountdown ? entry.desocupaEn : null);
  const clickable = entry.estado !== "FUERA_DE_SERVICIO";

  return (
    <div
      className={cx(
        "group relative overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)]",
        "transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-pop)]",
        entry.estado === "EXCEDIDO" && "animate-pulse-ring",
      )}
    >
      <div className="h-1.5 w-full" style={{ background: style.accent }} />

      <button type="button" onClick={() => clickable && onClick(entry)} disabled={!clickable} className="block w-full text-left disabled:cursor-default">
        <div className="relative bg-inset/60 p-2">
          <div className="aspect-[220/130] transition-transform duration-300 group-hover:scale-[1.03]">
            <RoomIllustration beds={beds} fans={fans} floorFill={style.floorFill} muted={style.muted} />
          </div>

          <span className="absolute left-3 top-3 rounded-lg bg-surface/95 px-2 py-0.5 text-lg font-bold tabular-nums text-ink shadow-sm backdrop-blur-sm">
            {entry.room.numero}
          </span>

          <span className={cx("absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold shadow-sm", style.tone)}>
            <Icon className="h-3.5 w-3.5" />
            {style.label}
          </span>
        </div>

        <div className="flex flex-col gap-0.5 px-3 py-2.5">
          {entry.clienteNombre ? (
            <>
              <p className="truncate text-sm font-medium text-ink">{entry.clienteNombre}</p>
              {remaining !== null && (
                <p className={cx("font-mono text-sm tabular-nums", remaining < 0 ? "text-danger" : "text-muted")}>
                  {remaining < 0 ? "Excedido +" : ""}
                  {formatDuration(remaining)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-subtle">
              {beds} cama{beds > 1 ? "s" : ""}
              {fans > 0 && ` · ${fans} ventilador${fans > 1 ? "es" : ""}`}
            </p>
          )}
        </div>
      </button>

      {entry.estado === "DISPONIBLE" && (
        <button
          type="button"
          title="Marcar en limpieza"
          onClick={() => void api.markCleaning(entry.room.id)}
          className="absolute bottom-2.5 right-2.5 rounded-full border border-line bg-surface p-1.5 text-subtle opacity-0 shadow-sm transition-all duration-200 hover:text-sky-500 group-hover:opacity-100"
        >
          <IconBroom className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
