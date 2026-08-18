import { useEffect, useRef, useState } from "react";
import type { FloorBoard, KioskSession } from "@casacarlos/contracts";
import { getToken } from "../api.js";

/** Live room board + mirrored kiosk session over the same WebSocket. Falls back to polling if the socket drops, and reconnects on its own. */
export function useBoard(enabled: boolean): { floors: FloorBoard[]; kioskSession: KioskSession | null; connected: boolean } {
  const [floors, setFloors] = useState<FloorBoard[]>([]);
  const [kioskSession, setKioskSession] = useState<KioskSession | null>(null);
  const [connected, setConnected] = useState(false);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let socket: WebSocket | null = null;
    let closedByEffect = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const token = getToken();
      if (!token) return;
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);

      socket.onopen = () => {
        setConnected(true);
        retryRef.current = 0;
      };
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "board") setFloors(msg.floors);
          if (msg.type === "kiosk") setKioskSession(msg.session);
        } catch {
          // ignore malformed frames
        }
      };
      socket.onclose = () => {
        setConnected(false);
        if (closedByEffect) return;
        const delay = Math.min(1000 * 2 ** retryRef.current, 10_000);
        retryRef.current += 1;
        retryTimer = setTimeout(connect, delay);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      closedByEffect = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [enabled]);

  return { floors, kioskSession, connected };
}
