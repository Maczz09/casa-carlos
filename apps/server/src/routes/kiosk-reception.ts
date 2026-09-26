import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";
import { requirePermission } from "../auth.js";

export function kioskReceptionRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requirePermission(services.identity, "SALES_MANAGE") };

    app.post<{ Body: { modalidadId: string; bloques?: number; noches?: number } }>(
      "/api/reception/kiosk/start",
      auth,
      async (request, reply) => {
        try {
          return await services.kiosk.start(request.user!.id, request.body.modalidadId, request.body.bloques ?? 1, request.body.noches ?? 1);
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.post<{ Body: { nombres: string; apellidos: string; dni: string; telefono?: string | null } }>(
      "/api/reception/kiosk/customer",
      auth,
      async (request, reply) => {
        try {
          return await services.kiosk.setCustomer(request.body);
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.post<{ Body: { actor: "CLIENTE" | "RECEPCION" } }>("/api/reception/kiosk/take-control", auth, async (request, reply) => {
      try {
        return await services.kiosk.takeControl(request.body.actor);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Body: { motivo?: string } }>("/api/reception/kiosk/cancel", auth, async (request, reply) => {
      try {
        await services.kiosk.reset(request.body.motivo ?? "Cancelado por recepción");
        return { ok: true };
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Body: { metodo: string | null } }>("/api/reception/kiosk/select-payment-method", auth, async (request, reply) => {
      try {
        return await services.kiosk.setPaymentMethod(request.body.metodo ?? null);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Body: { wants: boolean } }>("/api/reception/kiosk/set-wants-products", auth, async (request, reply) => {
      try {
        return await services.kiosk.setWantsProducts(Boolean(request.body.wants));
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}

