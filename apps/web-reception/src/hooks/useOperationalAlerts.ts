import { useCallback, useEffect, useRef, useState } from "react";
import type { FloorBoard, RoomStatus } from "@casacarlos/contracts";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

export interface OperationalAlert {
  id: string;
  title: string;
  message: string;
  tone: "info" | "warn" | "danger" | "ok";
}

const IMPORTANT_STATUS: Partial<Record<RoomStatus, { title: string; message: string; tone: OperationalAlert["tone"] }>> = {
  EN_TOLERANCIA: { title: "Tiempo cumplido", message: "El cuarto entró en tolerancia.", tone: "warn" },
  EXCEDIDO: { title: "Tiempo excedido", message: "El alquiler superó su tiempo y requiere atención.", tone: "danger" },
  LIMPIEZA: { title: "Limpieza iniciada", message: "El cuarto pasó a limpieza.", tone: "info" },
  DISPONIBLE: { title: "Cuarto disponible", message: "El cuarto quedó listo para una nueva venta.", tone: "ok" },
  RESERVADO: { title: "Reserva activa", message: "El cuarto quedó reservado.", tone: "info" },
};

async function playAlertTone(tone: OperationalAlert["tone"]): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    if (context.state === "suspended") await context.resume();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = tone === "danger" ? 740 : tone === "warn" ? 620 : 520;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.14, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.42);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.44);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // El aviso visual sigue funcionando aunque Windows bloquee audio automático.
  }
}

const isDesktopApp = () => Boolean(window.__TAURI_INTERNALS__?.invoke);

function showSystemNotification(alert: Pick<OperationalAlert, "title" | "message">): void {
  if (isDesktopApp()) {
    sendNotification({ title: alert.title, body: alert.message });
    return;
  }
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification(alert.title, { body: alert.message });
  }
}

export function useOperationalAlerts(floors: FloorBoard[], enabled: boolean) {
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const previous = useRef<Map<string, RoomStatus> | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const granted = isDesktopApp()
          ? await isPermissionGranted()
          : typeof Notification !== "undefined" && Notification.permission === "granted";
        if (active) setNotificationsEnabled(granted);
      } catch {
        if (active) setNotificationsEnabled(false);
      }
    };
    void check();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || floors.length === 0) return;
    const current = new Map<string, RoomStatus>();
    floors.forEach((floor) => floor.rooms.forEach((entry) => current.set(entry.room.id, entry.estado)));
    if (!previous.current) {
      previous.current = current;
      return;
    }

    const nextAlerts: OperationalAlert[] = [];
    floors.forEach((floor) => floor.rooms.forEach((entry) => {
      const from = previous.current?.get(entry.room.id);
      if (!from || from === entry.estado) return;
      const config = IMPORTANT_STATUS[entry.estado];
      if (!config) return;
      nextAlerts.push({
        id: `${entry.room.id}-${entry.estado}-${Date.now()}`,
        title: `${config.title} · Cuarto ${entry.room.numero}`,
        message: config.message,
        tone: config.tone,
      });
    }));
    previous.current = current;
    if (nextAlerts.length === 0) return;

    setAlerts((existing) => [...nextAlerts, ...existing].slice(0, 5));
    if (notificationsEnabled) {
      void playAlertTone(nextAlerts[0]!.tone);
      nextAlerts.forEach(showSystemNotification);
    }
  }, [enabled, floors, notificationsEnabled]);

  const enableNotifications = useCallback(async () => {
    const addFeedback = (title: string, message: string, tone: OperationalAlert["tone"]) => {
      setAlerts((current) => [{ id: `notification-${Date.now()}`, title, message, tone }, ...current].slice(0, 5));
    };
    try {
      if (typeof Notification === "undefined") {
        addFeedback("Avisos no disponibles", "Abrí la aplicación instalada de Hospedaje Carlos para activar los avisos de Windows.", "warn");
        return false;
      }
      let granted = isDesktopApp() ? await isPermissionGranted() : Notification.permission === "granted";
      if (!granted) {
        const permission = isDesktopApp() ? await requestPermission() : await Notification.requestPermission();
        granted = permission === "granted";
      }
      setNotificationsEnabled(granted);
      if (!granted) {
        addFeedback("Permiso no concedido", "Windows no autorizó las notificaciones. Podés habilitarlas desde Configuración > Sistema > Notificaciones.", "warn");
        return false;
      }
      const testAlert = {
        title: "Avisos activados",
        message: "Las alertas de cuartos se mostrarán en Windows y emitirán sonido.",
      };
      showSystemNotification(testAlert);
      await playAlertTone("ok");
      addFeedback(testAlert.title, "Notificación de prueba enviada correctamente.", "ok");
      return true;
    } catch (error) {
      setNotificationsEnabled(false);
      addFeedback("No se pudieron activar los avisos", error instanceof Error ? error.message : "La integración con Windows no respondió.", "danger");
      return false;
    }
  }, []);

  const dismiss = useCallback((id: string) => setAlerts((current) => current.filter((alert) => alert.id !== id)), []);
  return { alerts, dismiss, notificationsEnabled, enableNotifications };
}
