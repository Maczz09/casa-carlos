import { useEffect, useRef, type ComponentProps } from "react";
import { Workbook } from "@fortune-sheet/react";

const TOOL_NAMES: Record<string, string> = {
  undo: "Deshacer", redo: "Rehacer", "format-painter": "Copiar formato", "clear-format": "Borrar formato",
  "currency-format": "Formato de moneda", "percentage-format": "Formato de porcentaje",
  "number-decrease": "Reducir decimales", "number-increase": "Aumentar decimales", bold: "Negrita",
  italic: "Cursiva", "strike-through": "Tachado", underline: "Subrayado", "font-color": "Color de texto",
  background: "Color de fondo", border: "Bordes", "merge-cell": "Combinar celdas", freeze: "Inmovilizar",
  filter: "Filtrar", link: "Insertar enlace", image: "Insertar imagen", comment: "Comentario",
  "quick-formula": "Insertar fórmula", search: "Buscar", screenshot: "Capturar hoja",
  conditionFormat: "Formato condicional", dataVerification: "Validación de datos", splitColumn: "Separar columnas",
  locationCondition: "Seleccionar por condición",
};

/** Adaptación local para controles sin nombre ni activación por teclado en FortuneSheet 1.0.4. */
export function AccessibleWorkbook(props: ComponentProps<typeof Workbook>) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const nameControls = () => {
      root.querySelectorAll<HTMLElement>('[role="toolbar"] [role="button"]').forEach(control => {
        if (control.getAttribute("aria-label")?.trim() || control.textContent?.trim()) return;
        const use = control.querySelector("use");
        const icon = (use?.getAttribute("href") ?? use?.getAttribute("xlink:href") ?? "").split("#").at(-1) ?? "";
        const name = TOOL_NAMES[icon] ?? control.getAttribute("data-tips");
        if (name) { control.setAttribute("aria-label", name); control.setAttribute("title", name); }
      });
    };
    nameControls();
    const observer = new MutationObserver(nameControls);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  return <div ref={container} className="report-workbook h-full" onKeyDownCapture={event => {
    const target = event.target as HTMLElement;
    if (target.matches('[role="toolbar"] [role="button"]') && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.stopPropagation();
      target.click();
    }
  }}><Workbook {...props} /></div>;
}
