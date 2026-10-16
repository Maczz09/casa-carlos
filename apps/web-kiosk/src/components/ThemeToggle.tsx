import { ActionButton } from "@casacarlos/ui/components/action-button";
import { IconMoon, IconSun } from "@casacarlos/ui";
import type { Theme } from "../hooks/useTheme.js";

/**
 * Fijo en la esquina, presente sobre cualquier pantalla del kiosco — la
 * iluminación real del pasillo donde vive el kiosco no tiene por qué
 * coincidir con la del sistema operativo del equipo, así que se ofrece
 * como un control explícito en vez de solo seguir `prefers-color-scheme`.
 * Chico y de bajo contraste a propósito: no debe competir con el flujo del huésped.
 */
export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <ActionButton aria-label={theme === "dark" ? "Modo claro" : "Modo oscuro"}
      onClick={onToggle}
      title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
      className="fixed bottom-4 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-surface text-muted shadow-[var(--shadow-card)] ring-1 ring-line transition-all duration-150 hover:text-ink active:scale-90"
    >
      {theme === "dark" ? <IconSun className="h-5 w-5" /> : <IconMoon className="h-5 w-5" />}
    </ActionButton>
  );
}
