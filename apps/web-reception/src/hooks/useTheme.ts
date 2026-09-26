import { useEffect, useRef, useState } from "react";
import type { ThemeConfig, ThemeMode } from "@casacarlos/contracts";
import {
  DEFAULT_THEME_CONFIG,
  getPeruTime,
  isDarkAccordingToSchedule,
  resolveEffectiveTheme,
} from "@casacarlos/contracts";
import { api } from "../api.js";

export type Theme = ThemeMode;

const CONFIG_KEY = "casacarlos.theme_config";
const THEME_KEY = "casacarlos.theme";
const OVERRIDE_KEY = "casacarlos.theme_override";
const CHANNEL_NAME = "casacarlos_theme_sync";

function loadSavedConfig(): ThemeConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return DEFAULT_THEME_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      autoEnabled: typeof parsed.autoEnabled === "boolean" ? parsed.autoEnabled : DEFAULT_THEME_CONFIG.autoEnabled,
      startTime: typeof parsed.startTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.startTime) ? parsed.startTime : DEFAULT_THEME_CONFIG.startTime,
      endTime: typeof parsed.endTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.endTime) ? parsed.endTime : DEFAULT_THEME_CONFIG.endTime,
      manualTheme: parsed.manualTheme === "dark" ? "dark" : "light",
    };
  } catch {
    return DEFAULT_THEME_CONFIG;
  }
}

function loadInitialTheme(config: ThemeConfig): Theme {
  const override = localStorage.getItem(OVERRIDE_KEY);
  if (override === "light" || override === "dark") {
    return override;
  }
  return resolveEffectiveTheme(config);
}

function applyDomTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.documentElement.dataset.colorScheme = t;
  document.documentElement.style.colorScheme = t;
  localStorage.setItem(THEME_KEY, t);
}

export function useTheme() {
  const [config, setConfigState] = useState<ThemeConfig>(loadSavedConfig);
  const [theme, setThemeState] = useState<Theme>(() => loadInitialTheme(config));
  const [peruTime, setPeruTime] = useState(getPeruTime);
  const lastScheduledDark = useRef<boolean>(isDarkAccordingToSchedule(config));

  // Aplica el tema al DOM cada vez que cambia
  useEffect(() => {
    applyDomTheme(theme);
  }, [theme]);

  // Sincroniza la configuración con el servidor al cargar
  useEffect(() => {
    let active = true;
    api.themeConfig()
      .then((serverConfig) => {
        if (!active || !serverConfig) return;
        setConfigState((prev) => {
          const merged: ThemeConfig = {
            autoEnabled: typeof serverConfig.autoEnabled === "boolean" ? serverConfig.autoEnabled : prev.autoEnabled,
            startTime: serverConfig.startTime || prev.startTime,
            endTime: serverConfig.endTime || prev.endTime,
            manualTheme: serverConfig.manualTheme === "dark" ? "dark" : "light",
          };
          localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
          return merged;
        });
      })
      .catch(() => {
        // Si el servidor aún está iniciando o no responde, se mantiene la local
      });
    return () => {
      active = false;
    };
  }, []);

  // Timer para verificar la hora peruana y transiciones automáticas
  useEffect(() => {
    const checkTimeAndTheme = () => {
      const currentPeru = getPeruTime();
      setPeruTime(currentPeru);

      if (!config.autoEnabled) {
        // En modo manual, el tema es el configurado manualmente
        return;
      }

      const scheduledDark = isDarkAccordingToSchedule(config);
      // Si la ventana de horario cambió de día a noche o viceversa, se limpia cualquier override manual
      if (scheduledDark !== lastScheduledDark.current) {
        lastScheduledDark.current = scheduledDark;
        localStorage.removeItem(OVERRIDE_KEY);
        const nextTheme = scheduledDark ? "dark" : "light";
        setThemeState(nextTheme);
      } else {
        // Si no hay override activo, nos aseguramos que el tema coincida con el horario
        const override = localStorage.getItem(OVERRIDE_KEY);
        if (!override) {
          const expected = scheduledDark ? "dark" : "light";
          setThemeState(expected);
        }
      }
    };

    checkTimeAndTheme();
    // Chequeo cada 10 segundos para máxima precisión sin impacto en rendimiento
    const interval = setInterval(checkTimeAndTheme, 10_000);
    return () => clearInterval(interval);
  }, [config]);

  // Sincronización entre pestañas y ventanas
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CONFIG_KEY && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          setConfigState(updated);
          if (updated.autoEnabled) {
            setThemeState(resolveEffectiveTheme(updated));
          } else {
            setThemeState(updated.manualTheme);
          }
        } catch {}
      } else if (e.key === THEME_KEY && e.newValue) {
        if (e.newValue === "light" || e.newValue === "dark") {
          setThemeState(e.newValue);
        }
      }
    };

    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(CHANNEL_NAME);
        channel.onmessage = (event) => {
          if (event.data?.type === "CONFIG_UPDATE" && event.data.config) {
            setConfigState(event.data.config);
            setThemeState(event.data.theme);
          }
        };
      }
    } catch {}

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.close();
    };
  }, []);

  const updateConfig = async (patch: Partial<ThemeConfig>): Promise<ThemeConfig> => {
    const updated: ThemeConfig = {
      ...config,
      ...patch,
    };
    setConfigState(updated);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
    localStorage.removeItem(OVERRIDE_KEY);

    const nextTheme = resolveEffectiveTheme(updated);
    setThemeState(nextTheme);
    lastScheduledDark.current = isDarkAccordingToSchedule(updated);

    try {
      if (typeof BroadcastChannel !== "undefined") {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage({ type: "CONFIG_UPDATE", config: updated, theme: nextTheme });
        channel.close();
      }
    } catch {}

    try {
      await api.updateThemeConfig(updated);
    } catch {
      // Si falla llamada a API, queda guardado en localStorage de todos modos
    }

    return updated;
  };

  const toggle = () => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      if (!config.autoEnabled) {
        // En modo manual, persistimos el nuevo tema como manualTheme
        void updateConfig({ manualTheme: next });
      } else {
        // En modo automático, guardamos un override manual temporal hasta la siguiente transición horaria
        localStorage.setItem(OVERRIDE_KEY, next);
      }
      return next;
    });
  };

  return {
    theme,
    toggle,
    config,
    updateConfig,
    peruTime,
    isScheduledDark: isDarkAccordingToSchedule(config),
  };
}
