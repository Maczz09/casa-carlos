import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";
import { requirePermission } from "../auth.js";

export function reportingRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const admin = { preHandler: requirePermission(services.identity, "DASHBOARD_VIEW") };

    app.get<{ Querystring: { desde: string; hasta: string } }>("/api/reporting/dashboard", admin, async (request, reply) => {
      const { desde, hasta } = request.query;
      if (!desde || !hasta) {
        return reply.code(400).send({ error: "Se requieren los parámetros desde y hasta (YYYY-MM-DD)." });
      }
      try {
        return await services.reporting.getDashboard({ desde, hasta });
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
