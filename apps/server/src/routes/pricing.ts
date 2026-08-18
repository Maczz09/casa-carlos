import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";
import { requireAuth } from "../auth.js";

export function pricingRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAuth(services.identity) };

    app.get("/api/pricing/modalities", auth, async () => services.pricing.listModalities());

    app.get<{ Querystring: { categoriaId: string; modalidadId: string } }>(
      "/api/pricing/resolve",
      auth,
      async (request, reply) => {
        try {
          return await services.pricing.resolveRate({
            categoriaId: request.query.categoriaId,
            modalidadId: request.query.modalidadId,
            at: new Date(),
          });
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );
  };
}
