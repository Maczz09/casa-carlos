import type { FastifyInstance } from "fastify";
import type { ChargeCode } from "@casacarlos/contracts";
import type { Services } from "../index.js";
import { requirePermission } from "../auth.js";

export function salesRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requirePermission(services.identity, "SALES_MANAGE") };

    app.get("/api/sales/open", auth, async () => services.sales.listOpenSales());

    app.get<{ Querystring: { desde?: string; hasta?: string } }>("/api/sales", auth, async (request, reply) => {
      const { desde, hasta } = request.query;
      if (!desde || !hasta) return reply.code(400).send({ error: "Se requieren los parámetros desde y hasta (YYYY-MM-DD)." });
      return services.sales.listSalesByRange(desde, hasta);
    });

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

    app.get<{ Querystring: { desde?: string; hasta?: string } }>("/api/sales/cancelled", auth, async (request) => {
      const { desde, hasta } = request.query;
      return services.sales.listCancelledSales(desde, hasta);
    });

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

    app.post<{
      Params: { id: string };
      Body?: { motivo?: string; correlationId?: string; idempotencyKey?: string };
    }>("/api/sales/:id/cancel", auth, async (request, reply) => {
      try {
        const correlationId = (request.headers["x-correlation-id"] as string) || request.body?.correlationId;
        const idempotencyKey = (request.headers["idempotency-key"] as string) || request.body?.idempotencyKey;
        const motivo = request.body?.motivo ?? "Anulación de venta";

        const sale = await services.sales.cancelSale({
          saleId: request.params.id,
          motivo,
          usuarioId: request.user!.id,
          correlationId,
          idempotencyKey,
        });
        return sale;
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
