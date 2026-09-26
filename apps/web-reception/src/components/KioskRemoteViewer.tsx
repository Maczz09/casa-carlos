import { useState, useRef } from "react";
import { api } from "../api.js";
import { cx } from "./ui.js";

export function KioskRemoteViewer() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [kioskTheme, setKioskTheme] = useState<"dark" | "light">("light");

  const handleRemoteScroll = async (deltaY?: number, to?: "top" | "bottom") => {
    setBusy(true);
    try {
      // 1. Enviar comando remoto por WebSocket/HTTP a la pantalla física del cliente
      await api.scrollKiosk({ deltaY, to });

      // 2. Desplazar también el iframe local si es accesible
      if (iframeRef.current && iframeRef.current.contentWindow) {
        try {
          if (to === "top") iframeRef.current.contentWindow.scrollTo({ top: 0, behavior: "smooth" });
          else if (to === "bottom") iframeRef.current.contentWindow.scrollTo({ top: 99999, behavior: "smooth" });
          else if (deltaY) iframeRef.current.contentWindow.scrollBy({ top: deltaY, behavior: "smooth" });
        } catch {
          // cross-origin o restringido
        }
      }
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  const toggleKioskTheme = async () => {
    const next = kioskTheme === "dark" ? "light" : "dark";
    setKioskTheme(next);
    try {
      await api.syncKioskTheme(next);
      if (iframeRef.current && iframeRef.current.contentDocument) {
        iframeRef.current.contentDocument.documentElement.dataset.theme = next;
      }
    } catch {}
  };

  const sendFullscreenCommand = async () => {
    try {
      await api.sendKioskAction("fullscreen");
    } catch {}
  };

  return (
    <aside aria-label="Control remoto del kiosco" className="fixed bottom-4 right-4 z-50 flex flex-col items-end select-none">
      {/* Ventana flotante (PiP) */}
      {open && (
        <div
          role="dialog"
          aria-label="Pantalla del cliente en vivo"
          className="mb-3 flex h-[510px] w-[350px] sm:w-[390px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)] ring-1 ring-black/10 dark:ring-white/10 animate-fade-up"
        >
          {/* Barra superior de control */}
          <div className="flex items-center justify-between border-b border-line bg-raised px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-ink">Kiosco en vivo</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleKioskTheme}
                title="Cambiar modo claro / oscuro en la pantalla del kiosco"
                className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink hover:bg-inset active:scale-95 flex items-center gap-1"
              >
                <span>{kioskTheme === "dark" ? "☀️" : "🌙"}</span>
                <span className="text-[10px]">{kioskTheme === "dark" ? "Claro" : "Oscuro"}</span>
              </button>

              <button
                type="button"
                onClick={sendFullscreenCommand}
                title="Enviar kiosco a Pantalla 2 en Pantalla Completa"
                className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft active:scale-95"
              >
                🖥️ P2
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-1 rounded-lg p-1 text-subtle hover:bg-inset hover:text-ink"
                title="Minimizar visor"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Barra de navegación de scroll directo */}
          <div className="flex items-center justify-between border-b border-line bg-inset/90 px-3 py-1.5 text-xs">
            <span className="text-[11px] font-semibold text-muted">Scroll remoto:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void handleRemoteScroll(undefined, "top")}
                disabled={busy}
                title="Ir al inicio arriba"
                className="rounded border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink hover:bg-inset active:scale-95"
              >
                ⤒ Arriba
              </button>
              <button
                type="button"
                onClick={() => void handleRemoteScroll(-250)}
                disabled={busy}
                title="Subir pantalla del kiosco"
                className="flex items-center gap-1 rounded border border-line bg-surface px-2 py-0.5 text-xs font-bold text-ink hover:bg-inset active:scale-95"
              >
                ▲ Subir
              </button>
              <button
                type="button"
                onClick={() => void handleRemoteScroll(250)}
                disabled={busy}
                title="Bajar pantalla del kiosco"
                className="flex items-center gap-1 rounded border border-line bg-brand px-2 py-0.5 text-xs font-bold text-brand-ink hover:opacity-90 active:scale-95"
              >
                ▼ Bajar
              </button>
              <button
                type="button"
                onClick={() => void handleRemoteScroll(undefined, "bottom")}
                disabled={busy}
                title="Ir al final abajo"
                className="rounded border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink hover:bg-inset active:scale-95"
              >
                ⤓ Abajo
              </button>
            </div>
          </div>

          {/* Iframe con la pantalla del kiosco con reenvío de rueda de ratón */}
          <div
            className="relative flex-1 bg-black/5 overflow-hidden"
            onWheel={(e) => {
              void handleRemoteScroll(e.deltaY);
            }}
          >
            <iframe
              ref={iframeRef}
              src="/kiosk/"
              title="Vista previa del Kiosco"
              className="h-full w-full border-0 pointer-events-auto"
            />
          </div>

          {/* Barra inferior explicativa */}
          <div className="flex items-center justify-between border-t border-line bg-inset/80 px-3 py-1.5 text-[11px] text-muted">
            <span>Rueda de ratón o botones mueven la pantalla 2</span>
            <button
              type="button"
              onClick={sendFullscreenCommand}
              className="text-brand font-semibold hover:underline"
            >
              Pantalla Completa 2
            </button>
          </div>
        </div>
      )}

      {/* Botón flotante / Píldora de activación rápida */}
      <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface/95 px-3 py-1.5 shadow-[var(--shadow-card)] backdrop-blur-md transition-all hover:shadow-[var(--shadow-pop)]">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 text-xs font-semibold text-ink"
          title="Ver y controlar la pantalla del cliente (2.° monitor)"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          <span>{open ? "Ocultar Kiosco" : "Control Kiosco"}</span>
        </button>

        {/* Botones directos sin necesidad de abrir la ventana */}
        <div className="flex items-center gap-1 border-l border-line pl-1.5">
          <button
            type="button"
            onClick={() => void handleRemoteScroll(-220)}
            disabled={busy}
            title="Subir pantalla del cliente (▲)"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-inset text-xs font-bold text-ink hover:bg-raised active:scale-95 disabled:opacity-50"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => void handleRemoteScroll(220)}
            disabled={busy}
            title="Bajar pantalla del cliente (▼)"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-ink hover:opacity-90 active:scale-95 disabled:opacity-50"
          >
            ▼
          </button>
        </div>
      </div>
    </aside>
  );
}
