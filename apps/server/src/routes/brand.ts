import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";
import { requireAdmin } from "../auth.js";

/**
 * Nombre y logo del hotel. El GET es público a propósito: lo consume el kiosco
 * (que no tiene login) y la pantalla de acceso de recepción, que todavía no
 * tiene sesión. No expone nada privado — es lo que cualquiera ve pintado en la
 * pared del mostrador. Cambiarlo sí es cosa del administrador.
 */
export function brandRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const admin = { preHandler: requireAdmin(services.identity) };

    app.get("/api/brand", async () => services.brand.read());

    app.patch<{ Body: { nombre: string; lema?: string | null } }>("/api/brand", admin, async (request, reply) => {
      try {
        return services.brand.setNombre(request.body.nombre ?? "", request.body.lema ?? null);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post("/api/brand/logo", admin, async (request, reply) => {
      try {
        const part = await request.file();
        if (!part) return reply.code(400).send({ error: "Elegí una imagen para el logo." });
        return services.brand.setLogo(await part.toBuffer());
      } catch (err) {
        const message = (err as Error).message;
        return reply.code(message.includes("límite") || message.includes("File too large") ? 413 : 400).send({ error: message });
      }
    });

    app.delete("/api/brand/logo", admin, async (request, reply) => {
      try {
        return services.brand.clearLogo();
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
