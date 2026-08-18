import type { RoomsPort, StaysPort } from "@casacarlos/contracts";

const TICK_MS = 15_000;

export interface SchedulerHandle {
  stop(): void;
}

/**
 * The clock, nothing more. Every deadline it acts on lives as a timestamp in
 * `rooms_cuartos.limpieza_hasta` or `stays_estadias.checkout_previsto` — see
 * REGLAS-DE-NEGOCIO.md §4 and ARQUITECTURA.md §2. A restart just re-evaluates
 * "what's overdue right now" against those columns, so a power cut never
 * loses a pending cleaning release or an overstay alert.
 */
export function startScheduler(rooms: RoomsPort, stays: StaysPort): SchedulerHandle {
  const tick = async () => {
    const now = new Date();
    try {
      await rooms.runTimers(now);
      await stays.runTimers(now);
    } catch (err) {
      console.error("[scheduler] tick failed:", err);
    }
  };

  void tick(); // catch up immediately on boot — covers time the process was off
  const interval = setInterval(tick, TICK_MS);

  return { stop: () => clearInterval(interval) };
}
