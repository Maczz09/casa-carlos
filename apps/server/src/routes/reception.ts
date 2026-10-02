import type { FastifyInstance } from "fastify";
import { cents, format } from "@casacarlos/money";
import type { Services } from "../index.js";
import { requirePermission } from "../auth.js";

/**
 * Post-checkin housekeeping actions the reception screen triggers directly.
 * Opening a *new* sale goes through the kiosk session now (routes/kiosk-*.ts)
 * so both screens stay in sync — see docs/REGLAS-DE-NEGOCIO.md §10.
 */
export function receptionRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requirePermission(services.identity, "SALES_MANAGE") };

    app.post<{ Params: { stayId: string }; Body?: { horaSalida?: string | null } }>("/api/reception/check-out/:stayId", auth, async (request, reply) => {
      const { stayId } = request.params;
      const exitTime = request.body?.horaSalida ? new Date(request.body.horaSalida) : new Date();
      await services.sales.syncOverstayCharge(stayId, exitTime);
      const sale = await services.sales.getSaleForStay(stayId);
      if (sale && sale.saldoCentimos > 0) {
        return reply.code(400).send({ error: `Hay un saldo pendiente de ${format(cents(sale.saldoCentimos))}. Cóbralo antes del check-out.` });
      }
      try {
        return await services.stays.checkOut(stayId, request.user!.id, request.body?.horaSalida);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
