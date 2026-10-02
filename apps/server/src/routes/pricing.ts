import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";
import { requireAnyPermission } from "../auth.js";

export function pricingRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAnyPermission(services.identity, ["SALES_MANAGE", "RESERVATIONS_MANAGE", "ROOMS_MANAGE"]) };

    app.get("/api/pricing/modalities", auth, async () => services.pricing.listModalities());

    app.patch<{
      Params: { id: string };
      Body: {
        nombre?: string;
        checkinFijo?: string | null;
        checkoutFijo?: string | null;
        duracionHoras?: number;
        toleranciaMin?: number;
        precioAdicionalCentimos?: number;
        tiempoAdicionalMinutos?: number;
        tiempoAdicionalHoras?: number;
      };
    }>("/api/pricing/modalities/:id", auth, async (request, reply) => {
      try {
        return await services.pricing.updateModality(request.params.id, request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

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
    app.get("/api/pricing/category-rates", auth, async () => {
      return services.pricing.listAllCategoryRates();
    });

    app.get<{ Params: { categoriaId: string } }>("/api/pricing/categories/:categoriaId/rates", auth, async (request, reply) => {
      try {
        const rates = await services.pricing.getCategoryRates(request.params.categoriaId);
        return rates ?? { categoriaId: request.params.categoriaId, precioHorasCentimos: 4000, precioNocheCentimos: 6000 };
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{
      Params: { categoriaId: string };
      Body: { precioHorasCentimos: number; precioNocheCentimos: number; precioNocheBCentimos?: number };
    }>("/api/pricing/categories/:categoriaId/rates", auth, async (request, reply) => {
      try {
        await services.pricing.setCategoryRates({
          categoriaId: request.params.categoriaId,
          precioHorasCentimos: request.body.precioHorasCentimos,
          precioNocheCentimos: request.body.precioNocheCentimos,
          precioNocheBCentimos: request.body.precioNocheBCentimos,
        });
        return { ok: true };
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
