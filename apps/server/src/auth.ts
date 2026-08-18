import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { IdentityPort, User } from "@casacarlos/contracts";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}

export function registerAuth(app: FastifyInstance): void {
  app.decorateRequest("user", undefined);
}

export function requireAuth(identity: IdentityPort) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    if (!token) {
      await reply.code(401).send({ error: "Falta el encabezado Authorization." });
      return;
    }
    try {
      request.user = await identity.getUserByToken(token);
    } catch {
      await reply.code(401).send({ error: "Sesión inválida o expirada." });
    }
  };
}

/** Como `requireAuth`, pero además exige rol ADMIN — para pantallas como el dashboard que no debe ver recepción. */
export function requireAdmin(identity: IdentityPort) {
  const auth = requireAuth(identity);
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    await auth(request, reply);
    if (reply.sent) return;
    if (request.user?.rol !== "ADMIN") {
      await reply.code(403).send({ error: "Solo un administrador puede acceder a esto." });
    }
  };
}

export async function userFromToken(identity: IdentityPort, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  try {
    return await identity.getUserByToken(token);
  } catch {
    return null;
  }
}
