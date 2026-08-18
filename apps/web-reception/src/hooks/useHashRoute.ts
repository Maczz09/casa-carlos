import { useEffect, useState } from "react";

/**
 * Ruteo por hash (#/caja, #/cuarto/<id>) sin dependencias nuevas.
 * Se usa hash y no History API a propósito: las SPA se sirven desde
 * `@fastify/static` sin fallback a index.html, así que una ruta real
 * (/caja) daría 404 al recargar. Con hash, el navegador siempre pide `/`.
 */
export function useHashRoute() {
  const [path, setPath] = useState(() => window.location.hash.slice(1) || "/");

  useEffect(() => {
    const onChange = () => setPath(window.location.hash.slice(1) || "/");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const navigate = (to: string) => {
    window.location.hash = to;
  };

  const [, segment = "", param = ""] = path.split("/");
  return { path, segment, param, navigate };
}
