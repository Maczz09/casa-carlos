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

const CONFIG_KEY = "casacarlos-kiosk.theme_config";
const THEME_KEY = "casacarlos-kiosk.theme";
const OVERRIDE_KEY = "casacarlos-kiosk.theme_override";
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
  localStorage.setItem(THEME_KEY, t);
}

export function useTheme() {
  const [config, setConfigState] = useState<ThemeConfig>(loadSavedConfig);
  const [theme, setThemeState] = useState<Theme>(() => loadInitialTheme(config));
  const lastScheduledDark = useRef<boolean>(isDarkAccordingToSchedule(config));

  useEffect(() => {
    applyDomTheme(theme);
  }, [theme]);

  // Sincroniza la configuración con el servidor
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
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Timer para comprobar horario peruano periódicamente
  useEffect(() => {
    const checkSchedule = () => {
      if (!config.autoEnabled) return;
      const scheduledDark = isDarkAccordingToSchedule(config);
      if (scheduledDark !== lastScheduledDark.current) {
        lastScheduledDark.current = scheduledDark;
        localStorage.removeItem(OVERRIDE_KEY);
        setThemeState(scheduledDark ? "dark" : "light");
      } else {
        const override = localStorage.getItem(OVERRIDE_KEY);
        if (!override) {
          setThemeState(scheduledDark ? "dark" : "light");
        }
      }
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 10_000);
    return () => clearInterval(interval);
  }, [config]);

  // Sincronización entre pestañas / BroadcastChannel
  useEffect(() => {
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

    const handleStorage = (e: StorageEvent) => {
      if (e.key === CONFIG_KEY && e.newValue) {
        try {
          const updated = JSON.parse(e.newValue);
          setConfigState(updated);
          setThemeState(resolveEffectiveTheme(updated));
        } catch {}
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      channel?.close();
    };
  }, []);

  return {
    theme,
    toggle: () =>
      setThemeState((t) => {
        const next = t === "dark" ? "light" : "dark";
        localStorage.setItem(OVERRIDE_KEY, next);
        return next;
      }),
  };
}
