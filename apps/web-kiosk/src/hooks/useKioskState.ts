import { useEffect, useRef, useState } from "react";
import type { FloorBoard, KioskProduct, KioskSession } from "@casacarlos/contracts";

/** Same one-socket-two-message-types pattern as the reception app's `useBoard`, but with no auth token — the kiosk has no login. */
export function useKioskState(): { floors: FloorBoard[]; products: KioskProduct[]; session: KioskSession | null; connected: boolean } {
  const [floors, setFloors] = useState<FloorBoard[]>([]);
  const [products, setProducts] = useState<KioskProduct[]>([]);
  const [session, setSession] = useState<KioskSession | null>(null);
  const [connected, setConnected] = useState(false);
  const retryRef = useRef(0);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closedByEffect = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${window.location.host}/ws-kiosk`);

      socket.onopen = () => {
        setConnected(true);
        retryRef.current = 0;
      };
      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === "board") setFloors(msg.floors);
          if (msg.type === "kiosk") setSession(msg.session);
          if (msg.type === "products") setProducts(msg.products);
          if (msg.type === "kiosk_scroll") {
            const deltaY = typeof msg.deltaY === "number" ? msg.deltaY : 0;
            const to = msg.to;
            const doScroll = (el: Element | Window) => {
              try {
                if (to === "top") {
                  el.scrollTo({ top: 0, behavior: "smooth" });
                } else if (to === "bottom") {
                  const max = el instanceof Window ? Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) : el.scrollHeight;
                  el.scrollTo({ top: max, behavior: "smooth" });
                } else if (deltaY) {
                  el.scrollBy({ top: deltaY, behavior: "smooth" });
                }
              } catch {
                // ignore
              }
            };
            doScroll(window);
            document.querySelectorAll(".overflow-y-auto, .overflow-auto, main").forEach((el) => doScroll(el));
            window.dispatchEvent(new CustomEvent("casacarlos:remote-scroll", { detail: msg }));
          }
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
  }, []);

  return { floors, products, session, connected };
}
