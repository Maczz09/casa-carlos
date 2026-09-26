/**
 * Guarda una exportación en ambos contextos donde corre Recepción.
 *
 * En el navegador se descarga como cualquier archivo web. En la aplicación
 * Tauri, WebView2 no siempre muestra la descarga de un Blob, así que usamos
 * el comando nativo y lo dejamos directamente en Descargas.
 */
declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

function downloadInBrowser(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // WebView y algunos navegadores empiezan la descarga en el siguiente ciclo.
  // Revocar de inmediato deja el botón aparentemente sin efecto.
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function exportErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  try {
    const serialized = JSON.stringify(error);
    return serialized && serialized !== "{}" ? serialized : "Error desconocido.";
  } catch {
    return "Error desconocido.";
  }
}

export async function saveExport(blob: Blob, filename: string): Promise<{ desktop: boolean; location?: string }> {
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (!invoke) {
    downloadInBrowser(blob, filename);
    return { desktop: false };
  }

  const contents = Array.from(new Uint8Array(await blob.arrayBuffer()));
  const location = await invoke("save_export_file", { filename, contents });
  return { desktop: true, location: typeof location === "string" ? location : undefined };
}
