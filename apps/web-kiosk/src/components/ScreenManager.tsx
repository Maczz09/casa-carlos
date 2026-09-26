import { useEffect, useState } from "react";

const AUTO_SCREEN2_KEY = "casacarlos-kiosk.auto_screen2";

export function ScreenManager() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoScreen2, setAutoScreen2] = useState(() => localStorage.getItem(AUTO_SCREEN2_KEY) === "true");
  const [hasPrompt, setHasPrompt] = useState(false);
  const [screenCount, setScreenCount] = useState<number | null>(null);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      if (document.fullscreenElement) {
        setHasPrompt(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);

    // Detectar pantallas disponibles si la API está soportada
    if ("getScreenDetails" in window) {
      (window as unknown as { getScreenDetails: () => Promise<{ screens: unknown[] }> })
        .getScreenDetails()
        .then((details) => setScreenCount(details.screens.length))
        .catch(() => {});
    }

    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const triggerFullscreenOnScreen2 = async () => {
    try {
      // 1. Intentar API multi-pantalla moderna (Chromium / Edge WebView2)
      if ("getScreenDetails" in window) {
        try {
          const details = await (window as unknown as { getScreenDetails: () => Promise<{ screens: Array<{ isPrimary?: boolean }> }> }).getScreenDetails();
          if (details.screens && details.screens.length > 1) {
            const secondary = details.screens.find((s) => !s.isPrimary) || details.screens[1];
            await (document.documentElement as unknown as { requestFullscreen: (options?: { screen?: unknown }) => Promise<void> }).requestFullscreen({ screen: secondary });
            setIsFullscreen(true);
            setHasPrompt(false);
            return;
          }
        } catch {
          // fallback a requestFullscreen normal si el permiso fue denegado o no soportado
        }
      }

      // 2. Pantalla completa estándar
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
      setHasPrompt(false);
    } catch {
      // En caso de que el navegador requiera clic directo
      setHasPrompt(true);
    }
  };

  // Escuchar orden remota enviada desde Recepción
  useEffect(() => {
    const handleRemoteAction = (e: Event) => {
      const customEvent = e as CustomEvent<{ action?: string }>;
      if (customEvent.detail?.action === "fullscreen" || customEvent.detail?.action === "screen2") {
        void triggerFullscreenOnScreen2();
      }
    };
    window.addEventListener("casacarlos:kiosk-action", handleRemoteAction);
    return () => window.removeEventListener("casacarlos:kiosk-action", handleRemoteAction);
  }, []);

  // Si tiene autoScreen2 habilitado, al primer clic en cualquier lado activa pantalla completa
  useEffect(() => {
    if (!autoScreen2 || isFullscreen) return;

    const onFirstInteraction = () => {
      if (!document.fullscreenElement) {
        void triggerFullscreenOnScreen2();
      }
      window.removeEventListener("click", onFirstInteraction);
    };

    window.addEventListener("click", onFirstInteraction, { once: true });
    return () => window.removeEventListener("click", onFirstInteraction);
  }, [autoScreen2, isFullscreen]);

  const toggleAuto = (enabled: boolean) => {
    setAutoScreen2(enabled);
    localStorage.setItem(AUTO_SCREEN2_KEY, String(enabled));
    if (enabled && !isFullscreen) {
      void triggerFullscreenOnScreen2();
    }
  };

  return (
    <>
      {/* Banner de aviso si recepción solicitó pantalla completa y el navegador pide toque físico */}
      {hasPrompt && !isFullscreen && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <button
            type="button"
            onClick={triggerFullscreenOnScreen2}
            className="flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-brand-ink shadow-2xl ring-2 ring-white"
          >
            <span>🖥️</span>
            <span>Toca aquí para activar Pantalla Completa en Pantalla 2</span>
          </button>
        </div>
      )}

      {/* Control flotante discreto en esquina superior izquierda */}
      <div className="fixed top-3 left-3 z-40 flex items-center gap-2 rounded-xl bg-surface/80 p-1.5 backdrop-blur-md border border-line text-xs shadow-sm transition-opacity hover:opacity-100 opacity-80 group">
        <button
          type="button"
          onClick={triggerFullscreenOnScreen2}
          title={isFullscreen ? "Salir de pantalla completa" : "Poner en Pantalla 2 y Pantalla Completa"}
          className="flex items-center gap-1.5 rounded-lg bg-inset px-2.5 py-1 font-semibold text-ink hover:bg-line active:scale-95 transition-all"
        >
          <span>{isFullscreen ? "🗗" : "🖥️"}</span>
          <span>{isFullscreen ? "Pantalla Normal" : screenCount && screenCount > 1 ? "Pantalla 2 Completa" : "Pantalla Completa"}</span>
        </button>

        <label className="flex items-center gap-1.5 px-1.5 cursor-pointer text-muted hover:text-ink select-none" title="Poner en pantalla 2 completa automáticamente">
          <input
            type="checkbox"
            checked={autoScreen2}
            onChange={(e) => toggleAuto(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-line text-brand accent-brand cursor-pointer"
          />
          <span className="text-[11px] font-medium hidden sm:inline">Auto Pantalla 2</span>
        </label>
      </div>
    </>
  );
}
