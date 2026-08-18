import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";
import { requireAuth } from "../auth.js";

export function authRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    app.post<{ Body: { usuario: string; password: string } }>("/api/auth/login", async (request, reply) => {
      try {
        const { usuario, password } = request.body;
        const result = await services.identity.login(usuario, password);
        return result;
      } catch (err) {
        return reply.code(401).send({ error: (err as Error).message });
      }
    });

    app.post<{ Body: { pin: string } }>("/api/auth/pin", async (request, reply) => {
      try {
        const result = await services.identity.switchByPin(request.body.pin);
        return result;
      } catch (err) {
        return reply.code(401).send({ error: (err as Error).message });
      }
    });

    app.get("/api/me", { preHandler: requireAuth(services.identity) }, async (request) => {
      return request.user;
    });
  };
}
