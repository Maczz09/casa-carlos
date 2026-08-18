import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";

/**
 * No auth on this router — the kiosk terminal has no login (see
 * docs/ARQUITECTURA.md §9, kiosco = token de dispositivo, sin persona). It
 * only ever reads or writes its own in-progress session, which never
 * carries other guests' data (rooms.getBoard(true) strips names).
 */
export function kioskPublicRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    app.get("/api/kiosk/current", async () => services.kiosk.getCurrent());
    app.get("/api/kiosk/board", async () => services.rooms.getBoard(true));
    app.get("/api/kiosk/floors", async () => services.rooms.listFloors());
    app.get("/api/kiosk/categories", async () => services.rooms.listCategories());
    app.get("/api/kiosk/attributes", async () => services.rooms.listAttributes());
    app.get("/api/kiosk/collection-accounts", async () => services.payments.listCollectionAccounts());
    app.get("/api/kiosk/modalities", async () => services.pricing.listModalities());

    app.post<{ Body: { pisoId: string } }>("/api/kiosk/select-floor", async (request, reply) => {
      try {
        return await services.kiosk.selectFloor(request.body.pisoId);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Body: { cuartoId: string } }>("/api/kiosk/select-room", async (request, reply) => {
      try {
        return await services.kiosk.selectRoom(request.body.cuartoId);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Body: { detalles: { metodo: string; montoCentimos: number }[] } }>("/api/kiosk/propose-payment", async (request, reply) => {
      try {
        return await services.kiosk.proposePayment(request.body.detalles);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post("/api/kiosk/reset", async (request, reply) => {
      try {
        await services.kiosk.reset("Reiniciado desde el kiosco");
        return { ok: true };
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
