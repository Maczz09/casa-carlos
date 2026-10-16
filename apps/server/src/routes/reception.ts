import type { CheckoutConfirmation } from "@casacarlos/contracts";
import type { FastifyInstance } from "fastify";
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

    app.post<{ Params: { stayId: string }; Body: { horaSalida: string; anularHorasExtra: boolean } }>("/api/reception/check-out-preview/:stayId", auth, async (request, reply) => {
      try { return await services.sales.previewCheckOut(request.params.stayId, request.body.horaSalida, request.body.anularHorasExtra); }
      catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
    });
    app.post<{ Params: { stayId: string }; Body: CheckoutConfirmation }>("/api/reception/check-out-confirm/:stayId", auth, async (request, reply) => {
      try { return await services.sales.confirmCheckOut(request.params.stayId, request.user!.id, request.body); }
      catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
    });

    app.post<{ Params: { stayId: string }; Body?: { horaSalida?: string | null } }>("/api/reception/check-out/:stayId", auth, async (request, reply) => {
      try {
        return await services.sales.checkOutStay(request.params.stayId, request.user!.id, request.body?.horaSalida);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
