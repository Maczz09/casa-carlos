import type { FastifyInstance } from "fastify";
import type { CreateCollectionAccountInput, PaymentDetailInput, UpdateCollectionAccountInput } from "@casacarlos/contracts";
import type { Services } from "../index.js";
import { requireAdmin, requireAuth } from "../auth.js";
import type { StoredImage } from "../image-storage.js";

export function paymentsRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAuth(services.identity) };
    const admin = { preHandler: requireAdmin(services.identity) };

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

    /* --------- Canales de cobro (billeteras y cuentas bancarias) --------- */

    // Recepción los lee para saber a qué cuenta le está entrando la plata
    // mientras cobra; solo un administrador puede cambiarlos.
    app.get("/api/payments/collection-accounts", auth, async (request) => {
      return request.user?.rol === "ADMIN" ? services.payments.listAllCollectionAccounts() : services.payments.listCollectionAccounts();
    });

    app.post<{ Body: CreateCollectionAccountInput }>("/api/payments/collection-accounts", admin, async (request, reply) => {
      try {
        return reply.code(201).send(await services.payments.createCollectionAccount(request.body, request.user!.id));
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.patch<{ Params: { id: string }; Body: UpdateCollectionAccountInput }>("/api/payments/collection-accounts/:id", admin, async (request, reply) => {
      try {
        return await services.payments.updateCollectionAccount(request.params.id, request.body, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.delete<{ Params: { id: string } }>("/api/payments/collection-accounts/:id", admin, async (request, reply) => {
      try {
        const cuenta = await services.payments.deleteCollectionAccount(request.params.id, request.user!.id);
        if (cuenta.qrArchivo) services.qrImages.delete(cuenta.qrArchivo);
        return reply.code(204).send();
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    // La foto del QR de la billetera: el hotel la exporta desde su app (Yape,
    // Plin…) y la sube tal cual. No se genera acá — un QR dibujado por el
    // sistema no cobra nada, solo el de la billetera real sirve.
    app.post<{ Params: { id: string } }>("/api/payments/collection-accounts/:id/qr", admin, async (request, reply) => {
      let stored: StoredImage | null = null;
      try {
        const part = await request.file();
        if (!part) return reply.code(400).send({ error: "Elegí la imagen del QR." });
        stored = services.qrImages.save(await part.toBuffer());
        const { cuenta, archivoAnterior } = await services.payments.setCollectionAccountQr(
          request.params.id,
          { archivo: stored.archivo, mimeType: stored.mimeType },
          request.user!.id,
        );
        if (archivoAnterior) services.qrImages.delete(archivoAnterior);
        return cuenta;
      } catch (err) {
        if (stored) {
          try {
            services.qrImages.delete(stored.archivo);
          } catch {
            // Un archivo huérfano es preferible a ocultar el error original.
          }
        }
        const message = (err as Error).message;
        return reply.code(message.includes("límite") || message.includes("File too large") ? 413 : 400).send({ error: message });
      }
    });

    app.delete<{ Params: { id: string } }>("/api/payments/collection-accounts/:id/qr", admin, async (request, reply) => {
      try {
        const { cuenta, archivoAnterior } = await services.payments.clearCollectionAccountQr(request.params.id, request.user!.id);
        if (archivoAnterior) services.qrImages.delete(archivoAnterior);
        return cuenta;
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
