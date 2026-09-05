import { useEffect, useRef } from "react";
import type { KioskSession } from "@casacarlos/contracts";
import { api } from "../api.js";

const TERMINAL_DELAY_MS = 20_000;
const IDLE_DELAY_MS = 120_000;

/** Returns the kiosk to ESPERA after a guest walks away mid-flow, or a fixed pause after a finished transaction. */
export function useInactivityReset(session: KioskSession | null): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Con cuerpo de bloque a propósito: como expresión devolvía `number | 0`,
    // y React exige que la función de limpieza de un efecto no devuelva nada.
    const clear = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    clear();

    if (!session || session.estado === "ESPERA") return;

    const isTerminal = session.estado === "ACEPTADO" || session.estado === "RECHAZADO";
    const delay = isTerminal ? TERMINAL_DELAY_MS : IDLE_DELAY_MS;

    const schedule = () => {
      clear();
      timerRef.current = setTimeout(() => void api.reset(), delay);
    };

    schedule();

    if (isTerminal) return clear;

    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, schedule));
    return () => {
      clear();
      events.forEach((e) => window.removeEventListener(e, schedule));
    };
  }, [session?.id, session?.estado]);
}
