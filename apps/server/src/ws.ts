import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import type { EventBus } from "@casacarlos/bus";
import type { IdentityPort, RoomsPort } from "@casacarlos/contracts";
import type { KioskStore } from "./kiosk/store.js";
import { userFromToken } from "./auth.js";

/**
 * Two message types, both full-state pushes (never diffs): `{type:"board",
 * floors}` and `{type:"kiosk", session}`. Every domain event and every
 * kiosk-session change re-pushes both to every connected screen — reception
 * and the kiosk terminal are two views of the same truth, see
 * REGLAS-DE-NEGOCIO.md §10.
 */
export function registerWebSocketGateway(app: FastifyInstance, bus: EventBus, rooms: RoomsPort, identity: IdentityPort, kiosk: KioskStore): void {
  const receptionSockets = new Set<WebSocket>();
  const kioskSockets = new Set<WebSocket>();

  const send = (sockets: Set<WebSocket>, payload: unknown) => {
    if (sockets.size === 0) return;
    const message = JSON.stringify(payload);
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) socket.send(message);
    }
  };

  const broadcastBoard = async () => {
    const [staffBoard, kioskBoard] = await Promise.all([rooms.getBoard(false), rooms.getBoard(true)]);
    send(receptionSockets, { type: "board", floors: staffBoard });
    send(kioskSockets, { type: "board", floors: kioskBoard });
  };

  const broadcastKioskSession = () => {
    const payload = { type: "kiosk", session: kiosk.getCurrent() };
    send(receptionSockets, payload);
    send(kioskSockets, payload);
  };

  bus.subscribeAll(() => void broadcastBoard());
  kiosk.onChange(() => broadcastKioskSession());

  app.get("/ws", { websocket: true }, async (socket: WebSocket, request) => {
    const token = (request.query as { token?: string } | undefined)?.token;
    const user = await userFromToken(identity, token);
    if (!user) {
      socket.close(4401, "unauthorized");
      return;
    }

    receptionSockets.add(socket);
    socket.send(JSON.stringify({ type: "board", floors: await rooms.getBoard(false) }));
    socket.send(JSON.stringify({ type: "kiosk", session: kiosk.getCurrent() }));

    socket.on("close", () => receptionSockets.delete(socket));
    socket.on("error", () => receptionSockets.delete(socket));
  });

  app.get("/ws-kiosk", { websocket: true }, async (socket: WebSocket) => {
    kioskSockets.add(socket);
    socket.send(JSON.stringify({ type: "board", floors: await rooms.getBoard(true) }));
    socket.send(JSON.stringify({ type: "kiosk", session: kiosk.getCurrent() }));

    socket.on("close", () => kioskSockets.delete(socket));
    socket.on("error", () => kioskSockets.delete(socket));
  });
}
