import type { NotificationsService } from "./service.js";

const TICK_MS = 10_000;

export interface NotificationsWorkerHandle {
  stop(): void;
}

/**
 * Envía los mensajes encolados fuera del tick del bus: un envío real de
 * WhatsApp puede tardar segundos, y el bus espera a cada handler antes de
 * pasar al siguiente — bloquearlo ahí retrasaría el resto de la app. `encolar`
 * (en `service.ts`) solo hace un insert rápido; este poller es quien intenta
 * el envío, igual que `services/scheduler` hace con los timers de estadías.
 */
export function startNotificationsWorker(service: NotificationsService): NotificationsWorkerHandle {
  const tick = async () => {
    try {
      await service.processPending();
    } catch (err) {
      console.error("[notifications] worker tick falló:", err);
    }
  };

  void tick();
  const interval = setInterval(tick, TICK_MS);
  return { stop: () => clearInterval(interval) };
}
