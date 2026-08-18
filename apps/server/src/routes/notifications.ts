import type { FastifyInstance } from "fastify";
import type { CreateRecipientInput, NotificationState, UpdateRecipientInput } from "@casacarlos/contracts";
import type { Services } from "../index.js";
import { requireAdmin } from "../auth.js";

export function notificationsRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const admin = { preHandler: requireAdmin(services.identity) };

    app.get("/api/notifications/recipients", admin, async () => services.notifications.listRecipients());

    app.post<{ Body: CreateRecipientInput }>("/api/notifications/recipients", admin, async (request, reply) => {
      try {
        return await services.notifications.createRecipient(request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.patch<{ Params: { id: string }; Body: UpdateRecipientInput }>("/api/notifications/recipients/:id", admin, async (request, reply) => {
      try {
        return await services.notifications.updateRecipient(request.params.id, request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get("/api/notifications/templates", admin, async () => services.notifications.listTemplates());

    app.patch<{ Params: { codigo: "STAY_OVERSTAYED" | "LOW_STOCK" | "SHIFT_DIFFERENCE" }; Body: { cuerpo: string } }>(
      "/api/notifications/templates/:codigo",
      admin,
      async (request, reply) => {
        try {
          return await services.notifications.updateTemplate(request.params.codigo, request.body.cuerpo);
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.get<{ Querystring: { estado?: NotificationState } }>("/api/notifications/queue", admin, async (request) =>
      services.notifications.listQueue(request.query.estado),
    );

    app.post<{ Params: { id: string } }>("/api/notifications/queue/:id/retry", admin, async (request, reply) => {
      try {
        return await services.notifications.retry(request.params.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
