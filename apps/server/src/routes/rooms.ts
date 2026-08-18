import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";
import { requireAuth } from "../auth.js";

export function roomsRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAuth(services.identity) };

    app.get("/api/rooms/board", auth, async () => services.rooms.getBoard(false));
    app.get("/api/rooms/floors", auth, async () => services.rooms.listFloors());
    app.get("/api/rooms/categories", auth, async () => services.rooms.listCategories());
    app.get("/api/rooms/attributes", auth, async () => services.rooms.listAttributes());
    app.get("/api/rooms", auth, async () => services.rooms.listRooms());

    app.post<{ Params: { id: string }; Body: { minutes?: number } }>("/api/rooms/:id/cleaning", auth, async (request, reply) => {
      try {
        return await services.rooms.markCleaning(request.params.id, request.user!.id, request.body?.minutes);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string } }>("/api/rooms/:id/cleaning/finish", auth, async (request, reply) => {
      try {
        return await services.rooms.finishCleaning(request.params.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { motivo: string } }>("/api/rooms/:id/out-of-service", auth, async (request, reply) => {
      try {
        return await services.rooms.setOutOfService(request.params.id, request.body.motivo, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string } }>("/api/rooms/:id/return-to-service", auth, async (request, reply) => {
      try {
        return await services.rooms.returnToService(request.params.id, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
