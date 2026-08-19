import type { FastifyInstance } from "fastify";
import type { CreateRecipientInput, NotificationState, UpdateRecipientInput } from "@casacarlos/contracts";
import type { Services } from "../index.js";
import { requireAdmin } from "../auth.js";

export function notificationsRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const admin = { preHandler: requireAdmin(services.identity) };

    app.get("/api/notifications/recipients", admin, async () => services.notifications.listRecipients());

    app.post<{ Body: CreateRecipientInput }>("/api/notifications/recipients", admin, async (request, reply) => {
      try {
        return await services.notifications.createRecipient(request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.patch<{ Params: { id: string }; Body: UpdateRecipientInput }>("/api/notifications/recipients/:id", admin, async (request, reply) => {
      try {
        return await services.notifications.updateRecipient(request.params.id, request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get("/api/notifications/templates", admin, async () => services.notifications.listTemplates());

    app.patch<{ Params: { codigo: "STAY_OVERSTAYED" | "LOW_STOCK" | "SHIFT_DIFFERENCE" }; Body: { cuerpo: string } }>(
      "/api/notifications/templates/:codigo",
      admin,
      async (request, reply) => {
        try {
          return await services.notifications.updateTemplate(request.params.codigo, request.body.cuerpo);
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.get<{ Querystring: { estado?: NotificationState } }>("/api/notifications/queue", admin, async (request) =>
      services.notifications.listQueue(request.query.estado),
    );

    app.post<{ Params: { id: string } }>("/api/notifications/queue/:id/retry", admin, async (request, reply) => {
      try {
        return await services.notifications.retry(request.params.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get("/api/notifications/whatsapp/status", admin, async () => ({
      status: services.whatsapp.getStatus(),
      qr: services.whatsapp.getQr(),
    }));

    // "Conectar"/"Desconectar" solo dejan la orden anotada: quien abre WhatsApp
    // de verdad es el agente (apps/whatsapp-agent), que la recoge en su próxima
    // sincronización -- el servidor no puede hacerlo por sí mismo, ver
    // services/notifications/src/whatsapp-bridge.ts. El frontend sondea /status.
    app.post("/api/notifications/whatsapp/connect", admin, async (_request, reply) => {
      if (!services.whatsapp.agenteEnLinea()) {
        return reply.code(409).send({
          error: "El agente de WhatsApp no está corriendo. Abrilo desde el acceso directo \"Hospedaje Carlos — WhatsApp\" y volvé a intentar.",
        });
      }
      services.whatsapp.requestConnect();
      return { status: services.whatsapp.getStatus(), qr: services.whatsapp.getQr() };
    });

    app.post("/api/notifications/whatsapp/disconnect", admin, async () => {
      services.whatsapp.requestDisconnect();
      return { status: services.whatsapp.getStatus(), qr: services.whatsapp.getQr() };
    });

    /**
     * Único punto de contacto del agente de WhatsApp: reporta en qué anda y se
     * lleva las órdenes del admin y los mensajes por enviar. No usa la sesión
     * de un usuario logueado (el agente no es una persona) sino el token local
     * compartido que el servidor genera en data/ -- ver ensureAgentToken.
     */
    app.post<{
      Body: {
        status: "DESCONECTADO" | "ESPERANDO_QR" | "CONECTADO";
        qr: string | null;
        resultados: { id: string; ok: boolean; error?: string }[];
      };
    }>("/api/notifications/whatsapp/agent/sync", async (request, reply) => {
      if (request.headers["x-agent-token"] !== services.agentToken) {
        return reply.code(401).send({ error: "Token de agente inválido." });
      }

      for (const resultado of request.body.resultados ?? []) {
        if (resultado.ok) await services.notifications.markSent(resultado.id);
        else await services.notifications.markFailed(resultado.id, resultado.error ?? "Error desconocido.");
      }

      const ordenes = services.whatsapp.sync(request.body.status, request.body.qr);
      // Solo se le pasan mensajes cuando ya está conectado: si no, los tomaría
      // para fallar al instante y quedarían FALLIDO sin haberlo intentado nunca.
      const pendientes =
        request.body.status === "CONECTADO"
          ? (await services.notifications.listPending()).map((i) => ({ id: i.id, telefono: i.destinatario, mensaje: i.mensaje }))
          : [];

      return { conectar: ordenes.conectar, desconectar: ordenes.desconectar, pendientes };
    });
  };
}
