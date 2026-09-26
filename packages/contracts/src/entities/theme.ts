import { z } from "zod";

export const ThemeModeSchema = z.enum(["light", "dark"]);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export const ThemeConfigSchema = z.object({
  /** Indica si el modo oscuro se activa automáticamente según el horario de Perú. */
  autoEnabled: z.boolean(),
  /** Hora de inicio en formato HH:mm (por defecto 18:00 / 6:00 PM). */
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido (HH:mm)"),
  /** Hora de fin en formato HH:mm (por defecto 07:00 / 7:00 AM). */
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato de hora inválido (HH:mm)"),
  /** Modo manual a usar si autoEnabled está desactivado. */
  manualTheme: ThemeModeSchema,
});

export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

export const DEFAULT_THEME_CONFIG: ThemeConfig = {
  autoEnabled: true,
  startTime: "18:00",
  endTime: "07:00",
  manualTheme: "light",
};

/**
 * Obtiene la hora y minuto actuales en la zona horaria de Perú (America/Lima, UTC-5).
 * Perú no utiliza horario de verano (DST), por lo que siempre es UTC-5.
 */
export function getPeruTime(date = new Date()): {
  hour: number;
  minute: number;
  second: number;
  timeString: string;
  timeString12: string;
} {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Lima",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const second = parseInt(parts.find((p) => p.type === "second")?.value ?? "0", 10);
    const timeString = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    const timeString12 = `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")} ${ampm}`;
    return { hour, minute, second, timeString, timeString12 };
  } catch {
    // Fallback: Perú es UTC-5
    const utcHours = date.getUTCHours();
    const utcMinutes = date.getUTCMinutes();
    const utcSeconds = date.getUTCSeconds();
    const peruHour = (utcHours - 5 + 24) % 24;
    const timeString = `${String(peruHour).padStart(2, "0")}:${String(utcMinutes).padStart(2, "0")}:${String(utcSeconds).padStart(2, "0")}`;
    const ampm = peruHour >= 12 ? "PM" : "AM";
    const hour12 = peruHour % 12 === 0 ? 12 : peruHour % 12;
    const timeString12 = `${String(hour12).padStart(2, "0")}:${String(utcMinutes).padStart(2, "0")}:${String(utcSeconds).padStart(2, "0")} ${ampm}`;
    return { hour: peruHour, minute: utcMinutes, second: utcSeconds, timeString, timeString12 };
  }
}

/**
 * Determina si en el horario actual de Perú corresponde modo oscuro según la configuración de inicio y fin.
 */
export function isDarkAccordingToSchedule(
  config: Pick<ThemeConfig, "startTime" | "endTime">,
  date = new Date(),
): boolean {
  const { hour, minute } = getPeruTime(date);
  const currentMinutes = hour * 60 + minute;

  const [startH, startM] = config.startTime.split(":").map(Number);
  const [endH, endM] = config.endTime.split(":").map(Number);
  const startMinutes = (startH ?? 18) * 60 + (startM ?? 0);
  const endMinutes = (endH ?? 7) * 60 + (endM ?? 0);

  if (startMinutes === endMinutes) return false;

  // Si startMinutes > endMinutes (ejemplo por defecto: 18:00 (1080) hasta 07:00 (420)),
  // el rango cruza la medianoche. Es oscuro si current >= 18:00 O current < 07:00.
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  // Si startMinutes < endMinutes (ejemplo: 20:00 a 23:00 en el mismo día)
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Resuelve el tema efectivo ("light" | "dark") según la configuración y la hora de Perú.
 */
export function resolveEffectiveTheme(config: ThemeConfig, date = new Date()): ThemeMode {
  if (!config.autoEnabled) {
    return config.manualTheme;
  }
  return isDarkAccordingToSchedule(config, date) ? "dark" : "light";
}
