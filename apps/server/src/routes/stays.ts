import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";
import { requireAuth } from "../auth.js";

export function staysRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAuth(services.identity) };

    app.get("/api/stays/active", auth, async () => services.stays.listActiveStays());

    app.get<{ Params: { id: string } }>("/api/stays/:id", auth, async (request, reply) => {
      try {
        return await services.stays.getStay(request.params.id);
      } catch (err) {
        return reply.code(404).send({ error: (err as Error).message });
      }
    });

    app.post<{
      Body: {
        cuartoId: string;
        modalidadId: string;
        reservadaPara: string;
        noches?: number;
        cliente: { nombres: string; apellidos: string; dni: string; telefono?: string | null };
      };
    }>("/api/stays/reservations", auth, async (request, reply) => {
      try {
        return await services.stays.createReservation({ ...request.body, usuarioId: request.user!.id });
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string } }>("/api/stays/:id/check-in", auth, async (request, reply) => {
      try {
        return await services.stays.checkInReservation(request.params.id, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { motivo: string } }>("/api/stays/:id/cancel", auth, async (request, reply) => {
      try {
        return await services.stays.cancel(request.params.id, request.body.motivo, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { blocks: number } }>("/api/stays/:id/extend", auth, async (request, reply) => {
      try {
        return await services.stays.extendByBlock(request.params.id, request.body.blocks, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string } }>("/api/stays/:id/add-night", auth, async (request, reply) => {
      try {
        return await services.stays.addNight(request.params.id, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
