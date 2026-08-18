import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";
import { requireAuth } from "../auth.js";

export function billingRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAuth(services.identity) };

    app.post<{ Body: { ventaId: string } }>("/api/billing/boleta", auth, async (request, reply) => {
      try {
        return await services.billing.issueBoleta(request.body.ventaId, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Body: { ventaId: string; ruc: string; razonSocial: string } }>("/api/billing/factura", auth, async (request, reply) => {
      try {
        return await services.billing.issueFactura({ ...request.body, usuarioId: request.user!.id });
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get<{ Params: { ventaId: string } }>("/api/billing/for-sale/:ventaId", auth, async (request) => services.billing.getForSale(request.params.ventaId));

    app.get<{ Querystring: { desde?: string; hasta?: string } }>("/api/billing", auth, async (request) => {
      const { desde, hasta } = request.query;
      return services.billing.listComprobantes(desde && hasta ? { desde, hasta } : undefined);
    });

    app.get<{ Params: { id: string } }>("/api/billing/:id", auth, async (request, reply) => {
      try {
        return await services.billing.getComprobante(request.params.id);
      } catch (err) {
        return reply.code(404).send({ error: (err as Error).message });
      }
    });

    app.get<{ Params: { id: string } }>("/api/billing/:id/xml", auth, async (request, reply) => {
      const xml = await services.billing.getXml(request.params.id);
      if (!xml) return reply.code(404).send({ error: "No hay XML guardado para este comprobante." });
      return reply.type("application/xml").send(xml);
    });

    app.get<{ Params: { id: string } }>("/api/billing/:id/pdf", auth, async (request, reply) => {
      const pdf = await services.billing.getPdf(request.params.id);
      if (!pdf) return reply.code(404).send({ error: "Comprobante no encontrado." });
      return reply.type("application/pdf").send(pdf);
    });

    app.post<{ Params: { id: string } }>("/api/billing/:id/retry", auth, async (request, reply) => {
      try {
        return await services.billing.retrySubmission(request.params.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get<{ Params: { id: string } }>("/api/billing/:id/baja", auth, async (request) => services.billing.getBajaForComprobante(request.params.id));

    app.post<{ Params: { id: string }; Body: { motivo: string } }>("/api/billing/:id/void", auth, async (request, reply) => {
      try {
        return await services.billing.voidComprobante(request.params.id, request.body.motivo, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
