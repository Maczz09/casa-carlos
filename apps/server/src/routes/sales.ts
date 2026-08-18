import type { FastifyInstance } from "fastify";
import type { ChargeCode } from "@casacarlos/contracts";
import type { Services } from "../index.js";
import { requireAuth } from "../auth.js";

export function salesRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAuth(services.identity) };

    app.get("/api/sales/open", auth, async () => services.sales.listOpenSales());

    app.get<{ Params: { id: string } }>("/api/sales/:id", auth, async (request, reply) => {
      try {
        return await services.sales.getSale(request.params.id);
      } catch (err) {
        return reply.code(404).send({ error: (err as Error).message });
      }
    });

    app.get<{ Params: { stayId: string } }>("/api/sales/for-stay/:stayId", auth, async (request) => {
      return services.sales.getSaleForStay(request.params.stayId);
    });

    app.post<{ Params: { id: string }; Body: { codigo: ChargeCode; cantidad: number } }>(
      "/api/sales/:id/extra-charge",
      auth,
      async (request, reply) => {
        try {
          return await services.sales.addExtraCharge({
            saleId: request.params.id,
            codigo: request.body.codigo,
            cantidad: request.body.cantidad,
            usuarioId: request.user!.id,
          });
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.post<{ Params: { id: string }; Body: { productoId: string; cantidad: number } }>(
      "/api/sales/:id/product-line",
      auth,
      async (request, reply) => {
        try {
          return await services.sales.addProductLine({
            saleId: request.params.id,
            productoId: request.body.productoId,
            cantidad: request.body.cantidad,
            usuarioId: request.user!.id,
          });
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.post<{ Params: { id: string; lineId: string }; Body: { motivo: string } }>(
      "/api/sales/:id/lines/:lineId/cancel",
      auth,
      async (request, reply) => {
        try {
          await services.sales.cancelLine(request.params.id, request.params.lineId, request.body.motivo, request.user!.id);
          return { ok: true };
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );
  };
}
