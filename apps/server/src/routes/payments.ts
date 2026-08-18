import type { FastifyInstance } from "fastify";
import type { PaymentDetailInput } from "@casacarlos/contracts";
import type { Services } from "../index.js";
import { requireAuth } from "../auth.js";

export function paymentsRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAuth(services.identity) };

    app.post<{ Body: { saleId: string; detalles: PaymentDetailInput[] } }>("/api/payments", auth, async (request, reply) => {
      try {
        return await services.payments.create(request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string } }>("/api/payments/:id/accept", auth, async (request, reply) => {
      try {
        return await services.payments.accept(request.params.id, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { motivo: string } }>("/api/payments/:id/reject", auth, async (request, reply) => {
      try {
        const payment = await services.payments.reject(request.params.id, request.body.motivo, request.user!.id);
        // A rejected payment frees the room: the sale cancels itself reacting to the
        // `payment.rejected` event (services/sales), and the stay is cancelled here so the
        // room goes back to DISPONIBLE — see docs/REGLAS-DE-NEGOCIO.md §10.
        const sale = await services.sales.getSale(payment.ventaId).catch(() => null);
        if (sale?.estadiaId) {
          await services.stays.cancel(sale.estadiaId, "Pago rechazado por recepción", request.user!.id).catch(() => {});
        }
        return payment;
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get<{ Params: { saleId: string } }>("/api/payments/for-sale/:saleId", auth, async (request) => {
      return services.payments.getForSale(request.params.saleId);
    });
  };
}
