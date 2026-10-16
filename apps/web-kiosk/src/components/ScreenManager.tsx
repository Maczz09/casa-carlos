import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuSeparator } from "@casacarlos/ui/components/dropdown-menu";
import { IconMonitor, IconMinimize } from "@casacarlos/ui";


import { ActionButton } from "@casacarlos/ui/components/action-button";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

const AUTO_SCREEN2_KEY = "casacarlos-kiosk.auto_screen2";

export function ScreenManager() {
  // CRÍTICO: Si está dentro de un iframe (como el control remoto en Recepción), NO hacer nada.
  // De lo contrario, un comando de pantalla completa desde recepción pone en pantalla completa
  // la pantalla de Recepción en lugar de solo la del cliente.
  const isInsideIframe = typeof window !== "undefined" && window.self !== window.top;
  if (isInsideIframe) {
    return null;
  }

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

    // 1. Detectar pantallas con Tauri si estamos en la app de escritorio
    if (window.__TAURI_INTERNALS__?.invoke) {
      window.__TAURI_INTERNALS__.invoke("get_screens_info")
        .then((res: unknown) => {
          const data = res as { count?: number; screens?: Array<{ name: string; is_primary: boolean }> };
          if (typeof data?.count === "number") {
            setScreenCount(data.count);
          }
        })
        .catch(() => {});
    } else if ("getScreenDetails" in window) {
      // 2. Detectar pantallas disponibles en navegador moderno
      (window as unknown as { getScreenDetails: () => Promise<{ screens: unknown[] }> })
        .getScreenDetails()
        .then((details) => setScreenCount(details.screens.length))
        .catch(() => {});
    }

    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const triggerFullscreenOnScreen2 = async () => {
    try {
      // 1. Comando nativo Tauri: mueve la ventana al monitor secundario y activa pantalla completa real
      if (window.__TAURI_INTERNALS__?.invoke) {
        try {
          await window.__TAURI_INTERNALS__.invoke("move_to_secondary_screen");
          setIsFullscreen(true);
          setHasPrompt(false);
          return;
        } catch (tauriError) {
          console.warn("Fallo invoke Tauri move_to_secondary_screen:", tauriError);
        }
      }

      // 2. Intentar API multi-pantalla moderna (Chromium / Edge WebView2)
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
          // fallback
        }
      }

      // 3. Pantalla completa estándar
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
          <ActionButton
            type="button"
            onClick={triggerFullscreenOnScreen2}
            className="flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-bold text-brand-ink shadow-2xl ring-2 ring-white"
          >
            <span><IconMonitor className="inline h-4 w-4 align-text-bottom" /></span>
            <span>Toca aquí para activar Pantalla Completa en Pantalla 2</span>
          </ActionButton>
        </div>
      )}

      {/* Control flotante discreto en esquina superior izquierda */}
      <DropdownMenu><DropdownMenuTrigger asChild><ActionButton aria-label="Opciones de pantalla" className="fixed bottom-4 left-4 z-40 grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm"><IconMonitor className="h-5 w-5" /></ActionButton></DropdownMenuTrigger><DropdownMenuContent side="top" align="start" className="w-72"><DropdownMenuLabel>Pantalla del huésped</DropdownMenuLabel><DropdownMenuItem onSelect={() => { void triggerFullscreenOnScreen2(); }}>{isFullscreen ? <IconMinimize className="h-4 w-4" /> : <IconMonitor className="h-4 w-4" />}{isFullscreen ? "Salir de pantalla completa" : "Activar pantalla completa"}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuCheckboxItem checked={autoScreen2} onCheckedChange={toggleAuto}>Usar pantalla 2 automáticamente</DropdownMenuCheckboxItem></DropdownMenuContent></DropdownMenu>
    </>
  );
}
