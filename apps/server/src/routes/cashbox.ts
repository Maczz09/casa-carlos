import type { FastifyInstance } from "fastify";
import type { Denominaciones } from "@casacarlos/contracts";
import type { Services } from "../index.js";
import { requireAuth } from "../auth.js";

export function cashboxRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAuth(services.identity) };

    app.get("/api/cashbox/templates", auth, async () => services.cashbox.listShiftTemplates());

    app.post<{ Body: { nombre: string; horaInicio: string; horaFin: string } }>("/api/cashbox/templates", auth, async (request, reply) => {
      try {
        return await services.cashbox.createShiftTemplate(request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get("/api/cashbox/shifts/mine", auth, async (request) => services.cashbox.getOpenShiftForUser(request.user!.id));

    app.get<{ Querystring: { desde?: string; hasta?: string } }>("/api/cashbox/shifts", auth, async (request) => {
      const { desde, hasta } = request.query;
      return services.cashbox.listShifts(desde && hasta ? { desde, hasta } : undefined);
    });

    app.get<{ Params: { id: string } }>("/api/cashbox/shifts/:id", auth, async (request, reply) => {
      try {
        return await services.cashbox.getShift(request.params.id);
      } catch (err) {
        return reply.code(404).send({ error: (err as Error).message });
      }
    });

    app.post<{ Body: { plantillaId?: string | null; aperturaCentimos: number } }>("/api/cashbox/shifts/open", auth, async (request, reply) => {
      try {
        return await services.cashbox.openShift({ ...request.body, usuarioId: request.user!.id });
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { denominaciones: Denominaciones; justificacion?: string | null } }>(
      "/api/cashbox/shifts/:id/close",
      auth,
      async (request, reply) => {
        try {
          return await services.cashbox.closeShift({ turnoId: request.params.id, usuarioId: request.user!.id, ...request.body });
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.post<{ Params: { id: string }; Body: { tipo: "INGRESO" | "EGRESO" | "AJUSTE"; montoCentimos: number; motivo: string } }>(
      "/api/cashbox/shifts/:id/movements",
      auth,
      async (request, reply) => {
        try {
          return await services.cashbox.addManualMovement({ turnoId: request.params.id, ...request.body, usuarioId: request.user!.id });
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.get<{ Params: { id: string } }>("/api/cashbox/shifts/:id/movements", auth, async (request) => services.cashbox.listMovements(request.params.id));

    app.post<{ Params: { id: string }; Body: { denominaciones: Denominaciones } }>("/api/cashbox/shifts/:id/arqueo", auth, async (request, reply) => {
      try {
        return await services.cashbox.registrarArqueo({ turnoId: request.params.id, denominaciones: request.body.denominaciones, usuarioId: request.user!.id });
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get<{ Params: { id: string } }>("/api/cashbox/shifts/:id/arqueos", auth, async (request) => services.cashbox.listArqueos(request.params.id));

    app.get<{ Params: { id: string } }>("/api/cashbox/shifts/:id/summary", auth, async (request, reply) => {
      try {
        return await services.cashbox.getShiftSummary(request.params.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get<{ Querystring: { desde: string; hasta: string } }>("/api/cashbox/summary", auth, async (request, reply) => {
      try {
        return await services.cashbox.getRangeSummary(request.query);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
