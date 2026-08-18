import type { FastifyInstance } from "fastify";
import { cents, format } from "@casacarlos/money";
import type { Services } from "../index.js";
import { requireAuth } from "../auth.js";

/**
 * Post-checkin housekeeping actions the reception screen triggers directly.
 * Opening a *new* sale goes through the kiosk session now (routes/kiosk-*.ts)
 * so both screens stay in sync — see docs/REGLAS-DE-NEGOCIO.md §10.
 */
export function receptionRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAuth(services.identity) };

    app.post<{ Params: { stayId: string } }>("/api/reception/check-out/:stayId", auth, async (request, reply) => {
      const { stayId } = request.params;
      const sale = await services.sales.getSaleForStay(stayId);
      if (sale && sale.saldoCentimos > 0) {
        return reply.code(400).send({ error: `Hay un saldo pendiente de ${format(cents(sale.saldoCentimos))}. Cóbralo antes del check-out.` });
      }
      try {
        return await services.stays.checkOut(stayId, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
