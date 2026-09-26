import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../api.js";
import { cx } from "./ui.js";

export type KioskViewerMode = "split" | "pip" | "closed";

export interface KioskRemoteViewerProps {
  mode: KioskViewerMode;
  onModeChange: (mode: KioskViewerMode) => void;
}

export function KioskRemoteViewer({ mode, onModeChange }: KioskRemoteViewerProps) {
  const [busy, setBusy] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [kioskTheme, setKioskTheme] = useState<"dark" | "light">("light");

  const scrollBuffer = useRef(0);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll remoto suave y con buffer para la rueda del ratón
  const bufferedRemoteScroll = useCallback((deltaY: number) => {
    scrollBuffer.current += deltaY;
    if (scrollTimeout.current) return;
    scrollTimeout.current = setTimeout(() => {
      const delta = scrollBuffer.current;
      scrollBuffer.current = 0;
      scrollTimeout.current = null;
      if (delta !== 0) {
        void api.scrollKiosk({ deltaY: Math.round(delta) });
      }
    }, 45);
  }, []);

  // Scroll directo inmediato (botones arriba/abajo)
  const handleDirectScroll = async (deltaY?: number, to?: "top" | "bottom") => {
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
          // ignore
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
      await api.sendKioskAction("screen2");
      void api.launchKiosk().catch(() => {});
    } catch {}
  };

  const reloadKiosk = async () => {
    try {
      await api.sendKioskAction("reload");
    } catch {}
    setIframeKey((k) => k + 1);
  };

  const cancelKiosk = async () => {
    if (!window.confirm("¿Deseas reiniciar la sesión actual del kiosco y volver a la pantalla de bienvenida?")) {
      return;
    }
    try {
      await api.cancelKiosk("Reiniciado desde recepción");
      setIframeKey((k) => k + 1);
    } catch {}
  };

  // Conectar eventos del iframe cuando cargue
  const handleIframeLoad = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      const win = iframeRef.current?.contentWindow;
      if (!win || !doc) return;

      // Aplicar tema actual en el iframe
      doc.documentElement.dataset.theme = kioskTheme;

      // Reenviar eventos de rueda del ratón dentro del iframe a la pantalla física
      const onIframeWheel = (e: WheelEvent) => {
        bufferedRemoteScroll(e.deltaY);
      };

      win.removeEventListener("wheel", onIframeWheel);
      win.addEventListener("wheel", onIframeWheel, { passive: true });
    } catch {
      // cross-origin
    }
  };

  // Re-enlazar eventos si cambia iframeRef
  useEffect(() => {
    handleIframeLoad();
  }, [iframeKey]);

  // Si está cerrado, mostrar solo la barra / píldora flotante compacta
  if (mode === "closed") {
    return (
      <aside aria-label="Control remoto del kiosco" className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 select-none animate-fade-up">
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface/95 px-3 py-1.5 shadow-[var(--shadow-card)] backdrop-blur-md transition-all hover:shadow-[var(--shadow-pop)] ring-1 ring-black/5 dark:ring-white/10">
          <button
            type="button"
            onClick={() => onModeChange("split")}
            className="flex items-center gap-2 text-xs font-bold text-ink hover:text-brand transition-colors"
            title="Abrir en pantalla dividida mitad y mitad (50% Recepción / 50% Kiosco)"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span>Control Kiosco</span>
          </button>

          <div className="flex items-center gap-1 border-l border-line pl-1.5">
            <button
              type="button"
              onClick={() => onModeChange("split")}
              title="Dividir pantalla mitad y mitad (50/50)"
              className="flex items-center gap-1 rounded-md bg-brand px-2 py-0.5 text-[11px] font-bold text-brand-ink hover:opacity-90 active:scale-95 transition-all shadow-sm"
            >
              <span>🗖</span>
              <span>50/50</span>
            </button>

            <button
              type="button"
              onClick={() => onModeChange("pip")}
              title="Abrir como ventana flotante pequeña"
              className="rounded-md border border-line bg-inset px-1.5 py-0.5 text-[11px] font-semibold text-ink hover:bg-raised active:scale-95 transition-all"
            >
              🗗 Flotante
            </button>

            <button
              type="button"
              onClick={() => void handleDirectScroll(-240)}
              disabled={busy}
              title="Subir pantalla del cliente (▲)"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-inset text-xs font-bold text-ink hover:bg-raised active:scale-95 disabled:opacity-50"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => void handleDirectScroll(240)}
              disabled={busy}
              title="Bajar pantalla del cliente (▼)"
              className="flex h-6 w-6 items-center justify-center rounded-full bg-inset text-xs font-bold text-ink hover:bg-raised active:scale-95 disabled:opacity-50"
            >
              ▼
            </button>
          </div>
        </div>
      </aside>
    );
  }

  // Vista en MODO DIVIDIDO (50% de la pantalla)
  if (mode === "split") {
    return (
      <div className="flex flex-col h-full w-full select-none bg-surface min-h-0 overflow-hidden">
        {/* Barra superior de título y controles principales */}
        <div className="flex items-center justify-between border-b border-line bg-raised/80 px-4 py-2.5 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-ink truncate flex items-center gap-1.5">
                <span>Kiosco en Vivo</span>
                <span className="rounded bg-brand/15 px-1.5 py-0.2 text-[10px] font-semibold text-brand">Pantalla 2</span>
              </p>
              <p className="text-[10px] text-muted truncate">Control interactivo remoto en tiempo real</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={toggleKioskTheme}
              title="Cambiar modo claro / oscuro en la pantalla del kiosco"
              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:bg-inset active:scale-95 flex items-center gap-1.5 shadow-sm transition-all"
            >
              <span>{kioskTheme === "dark" ? "☀️" : "🌙"}</span>
              <span className="text-[11px] hidden sm:inline">{kioskTheme === "dark" ? "Modo Claro" : "Modo Oscuro"}</span>
            </button>

            <button
              type="button"
              onClick={sendFullscreenCommand}
              title="Enviar kiosco a Pantalla 2 en Pantalla Completa"
              className="rounded-lg border border-line bg-surface px-2.5 py-1 text-xs font-bold text-brand hover:bg-brand-soft active:scale-95 flex items-center gap-1 shadow-sm transition-all"
            >
              <span>🖥️</span>
              <span className="text-[11px] hidden sm:inline">P2 Completa</span>
            </button>

            <button
              type="button"
              onClick={() => onModeChange("pip")}
              title="Cambiar a ventana flotante pequeña"
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink hover:bg-inset active:scale-95 transition-all"
            >
              🗗 Flotante
            </button>

            <button
              type="button"
              onClick={() => onModeChange("closed")}
              className="rounded-lg border border-line bg-surface p-1 text-muted hover:bg-inset hover:text-ink active:scale-95 transition-all"
              title="Cerrar vista dividida"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Barra de herramientas para scroll y atajos rápidos */}
        <div className="flex items-center justify-between border-b border-line bg-inset/90 px-3 py-1.5 text-xs shrink-0 flex-wrap gap-1">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-muted mr-1">Scroll P2:</span>
            <button
              type="button"
              onClick={() => void handleDirectScroll(undefined, "top")}
              disabled={busy}
              title="Ir al inicio arriba en la pantalla 2"
              className="rounded border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink hover:bg-inset active:scale-95 transition-all"
            >
              ⤒ Inicio
            </button>
            <button
              type="button"
              onClick={() => void handleDirectScroll(-250)}
              disabled={busy}
              title="Subir pantalla del cliente (▲)"
              className="flex items-center gap-1 rounded border border-line bg-surface px-2.5 py-0.5 text-xs font-bold text-ink hover:bg-raised active:scale-95 transition-all shadow-sm"
            >
              ▲ Subir
            </button>
            <button
              type="button"
              onClick={() => void handleDirectScroll(250)}
              disabled={busy}
              title="Bajar pantalla del cliente (▼)"
              className="flex items-center gap-1 rounded border border-line bg-brand px-2.5 py-0.5 text-xs font-bold text-brand-ink hover:opacity-90 active:scale-95 transition-all shadow-sm"
            >
              ▼ Bajar
            </button>
            <button
              type="button"
              onClick={() => void handleDirectScroll(undefined, "bottom")}
              disabled={busy}
              title="Ir al final abajo en la pantalla 2"
              className="rounded border border-line bg-surface px-2 py-0.5 text-xs font-medium text-ink hover:bg-inset active:scale-95 transition-all"
            >
              ⤓ Final
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={reloadKiosk}
              title="Recargar vista previa del kiosco"
              className="flex items-center gap-1 rounded border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted hover:text-ink active:scale-95 transition-all"
            >
              <span>🔄</span>
              <span>Recargar</span>
            </button>
            <button
              type="button"
              onClick={cancelKiosk}
              title="Reiniciar kiosco y cancelar la sesión activa"
              className="flex items-center gap-1 rounded border border-line bg-surface px-2 py-0.5 text-[11px] font-semibold text-danger hover:bg-danger-soft active:scale-95 transition-all"
            >
              <span>🛑</span>
              <span>Reiniciar</span>
            </button>
          </div>
        </div>

        {/* Viewport interactivo del Kiosco */}
        <div
          className="relative flex-1 bg-black/5 overflow-hidden min-h-0"
          onWheel={(e) => {
            bufferedRemoteScroll(e.deltaY);
          }}
        >
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src="/kiosk/"
            onLoad={handleIframeLoad}
            title="Vista previa y control del Kiosco"
            className="h-full w-full border-0 pointer-events-auto bg-bg"
          />
        </div>

        {/* Barra inferior informativa */}
        <div className="flex items-center justify-between border-t border-line bg-inset/90 px-3 py-1.5 text-[11px] text-muted shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-ink">💡 Control Directo:</span>
            <span>Haz clic o usa la rueda del ratón aquí para manejar la Pantalla 2.</span>
          </div>
          <button
            type="button"
            onClick={sendFullscreenCommand}
            className="text-brand font-bold hover:underline"
          >
            Activar Pantalla Completa P2
          </button>
        </div>
      </div>
    );
  }

  // Vista en MODO FLOTANTE (PiP)
  return (
    <aside aria-label="Control remoto del kiosco" className="fixed bottom-4 right-4 z-50 flex flex-col items-end select-none animate-fade-up">
      <div
        role="dialog"
        aria-label="Pantalla del cliente en vivo"
        className="mb-3 flex h-[540px] w-[380px] sm:w-[440px] max-w-[95vw] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)] ring-1 ring-black/10 dark:ring-white/10"
      >
        {/* Barra superior de control */}
        <div className="flex items-center justify-between border-b border-line bg-raised px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-bold text-ink">Kiosco en vivo</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onModeChange("split")}
              title="Dividir pantalla mitad y mitad (50/50)"
              className="rounded-lg border border-line bg-brand px-2 py-1 text-xs font-bold text-brand-ink hover:opacity-90 active:scale-95 flex items-center gap-1 shadow-sm transition-all"
            >
              <span>🗖</span>
              <span>Dividir 50/50</span>
            </button>

            <button
              type="button"
              onClick={toggleKioskTheme}
              title="Cambiar modo claro / oscuro en la pantalla del kiosco"
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-semibold text-ink hover:bg-inset active:scale-95 flex items-center gap-1"
            >
              <span>{kioskTheme === "dark" ? "☀️" : "🌙"}</span>
            </button>

            <button
              type="button"
              onClick={sendFullscreenCommand}
              title="Enviar kiosco a Pantalla 2 en Pantalla Completa"
              className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-bold text-brand hover:bg-brand-soft active:scale-95"
            >
              🖥️ P2
            </button>

            <button
              type="button"
              onClick={() => onModeChange("closed")}
              className="ml-1 rounded-lg p-1 text-subtle hover:bg-inset hover:text-ink active:scale-95"
              title="Minimizar visor"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Barra de navegación de scroll directo */}
        <div className="flex items-center justify-between border-b border-line bg-inset/90 px-3 py-1.5 text-xs">
          <span className="text-[11px] font-semibold text-muted">Scroll:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void handleDirectScroll(undefined, "top")}
              disabled={busy}
              title="Ir al inicio arriba"
              className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs font-medium text-ink hover:bg-inset active:scale-95"
            >
              ⤒
            </button>
            <button
              type="button"
              onClick={() => void handleDirectScroll(-240)}
              disabled={busy}
              title="Subir pantalla del kiosco"
              className="flex items-center gap-0.5 rounded border border-line bg-surface px-2 py-0.5 text-xs font-bold text-ink hover:bg-inset active:scale-95"
            >
              ▲ Subir
            </button>
            <button
              type="button"
              onClick={() => void handleDirectScroll(240)}
              disabled={busy}
              title="Bajar pantalla del kiosco"
              className="flex items-center gap-0.5 rounded border border-line bg-brand px-2 py-0.5 text-xs font-bold text-brand-ink hover:opacity-90 active:scale-95"
            >
              ▼ Bajar
            </button>
            <button
              type="button"
              onClick={() => void handleDirectScroll(undefined, "bottom")}
              disabled={busy}
              title="Ir al final abajo"
              className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs font-medium text-ink hover:bg-inset active:scale-95"
            >
              ⤓
            </button>
          </div>
        </div>

        {/* Iframe con la pantalla del kiosco */}
        <div
          className="relative flex-1 bg-black/5 overflow-hidden"
          onWheel={(e) => {
            bufferedRemoteScroll(e.deltaY);
          }}
        >
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src="/kiosk/"
            onLoad={handleIframeLoad}
            title="Vista previa del Kiosco"
            className="h-full w-full border-0 pointer-events-auto bg-bg"
          />
        </div>

        {/* Barra inferior explicativa */}
        <div className="flex items-center justify-between border-t border-line bg-inset/80 px-3 py-1.5 text-[11px] text-muted">
          <span>Rueda de ratón sincroniza la P2</span>
          <button
            type="button"
            onClick={() => onModeChange("split")}
            className="text-brand font-bold hover:underline"
          >
            Abrir en 50/50
          </button>
        </div>
      </div>
    </aside>
  );
}
