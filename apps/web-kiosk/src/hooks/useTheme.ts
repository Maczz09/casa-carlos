import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "casacarlos-kiosk.theme";

function initial(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Copia local del hook de recepción — cada app tiene su propia clave de localStorage y su propia paleta; solo el mecanismo (data-theme en <html>) es el mismo. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}
