/**
 * Utilidades para formato de hora y fecha en formato estándar de 12 horas (AM / PM).
 */

/** Convierte una hora en formato 24h ("HH:mm") a formato 12h (ej: "19:00" -> "7:00 PM", "08:30" -> "8:30 AM") */
export function formatTime12h(time24?: string | null): string {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr ?? "0", 10);
  const m = parseInt(mStr ?? "0", 10);
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Formatea una fecha o string ISO a "DD/MM/YYYY, h:mm AM/PM" */
export function formatDateTime12h(date?: string | Date | number | null): string {
  if (!date) return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  try {
    const formatter = new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return formatter.format(d).replace(/\s+([ap]\.?\s?m\.?)/i, (_, p) => (p.toLowerCase().includes("p") ? " PM" : " AM"));
  } catch {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${day}/${month}/${year}, ${h12}:${m} ${ampm}`;
  }
}

/** Formatea solo la hora de una fecha a "h:mm AM/PM" o "h:mm:ss AM/PM" */
export function formatTimeOnly12h(date?: string | Date | number | null, includeSeconds = false): string {
  if (!date) return "";
  const d = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  try {
    const formatter = new Intl.DateTimeFormat("es-PE", {
      hour: "numeric",
      minute: "2-digit",
      second: includeSeconds ? "2-digit" : undefined,
      hour12: true,
    });
    return formatter.format(d).replace(/\s+([ap]\.?\s?m\.?)/i, (_, p) => (p.toLowerCase().includes("p") ? " PM" : " AM"));
  } catch {
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m}${includeSeconds ? `:${s}` : ""} ${ampm}`;
  }
}
