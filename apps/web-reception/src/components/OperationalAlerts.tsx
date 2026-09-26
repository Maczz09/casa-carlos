import type { OperationalAlert } from "../hooks/useOperationalAlerts.js";
import { cx } from "./ui.js";

export function OperationalAlerts({ alerts, onDismiss }: { alerts: OperationalAlert[]; onDismiss: (id: string) => void }) {
  if (alerts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-20 z-[80] flex w-[min(92vw,380px)] flex-col gap-2">
      {alerts.map((alert) => (
        <button
          key={alert.id}
          onClick={() => onDismiss(alert.id)}
          className={cx(
            "pointer-events-auto animate-slide-left rounded-2xl border bg-surface p-4 text-left shadow-[var(--shadow-pop)]",
            alert.tone === "danger" ? "border-danger/35" : alert.tone === "warn" ? "border-warn/35" : alert.tone === "ok" ? "border-ok/35" : "border-brand/30",
          )}
        >
          <span className="block text-sm font-semibold text-ink">{alert.title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted">{alert.message} · Tocá para cerrar</span>
        </button>
      ))}
    </div>
  );
}
