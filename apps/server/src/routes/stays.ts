import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";
import { requireAnyPermission, requirePermission } from "../auth.js";

export function staysRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const view = { preHandler: requireAnyPermission(services.identity, ["BOARD_VIEW", "SALES_MANAGE", "RESERVATIONS_MANAGE"]) };
    const reservations = { preHandler: requirePermission(services.identity, "RESERVATIONS_MANAGE") };
    const operate = { preHandler: requireAnyPermission(services.identity, ["SALES_MANAGE", "RESERVATIONS_MANAGE"]) };

    app.get("/api/stays/active", view, async () => services.stays.listActiveStays());

    app.get<{ Querystring: { desde: string; hasta: string } }>("/api/stays", view, async (request, reply) => {
      try {
        if (!request.query.desde || !request.query.hasta) return reply.code(400).send({ error: "Se requieren las fechas desde y hasta." });
        return await services.stays.listStays(request.query);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get<{ Params: { id: string } }>("/api/stays/:id", view, async (request, reply) => {
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
    }>("/api/stays/reservations", reservations, async (request, reply) => {
      try {
        return await services.stays.createReservation({ ...request.body, usuarioId: request.user!.id });
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string } }>("/api/stays/:id/check-in", operate, async (request, reply) => {
      try {
        return await services.stays.checkInReservation(request.params.id, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { motivo: string } }>("/api/stays/:id/cancel", operate, async (request, reply) => {
      try {
        return await services.stays.cancel(request.params.id, request.body.motivo, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { blocks: number } }>("/api/stays/:id/extend", operate, async (request, reply) => {
      try {
        return await services.stays.extendByBlock(request.params.id, request.body.blocks, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string } }>("/api/stays/:id/add-night", operate, async (request, reply) => {
      try {
        return await services.stays.addNight(request.params.id, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
