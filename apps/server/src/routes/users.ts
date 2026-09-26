import type { FastifyInstance } from "fastify";
import type { CreateUserInput, UpdateUserInput } from "@casacarlos/contracts";
import type { Services } from "../index.js";
import { requirePermission } from "../auth.js";

export function usersRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const manageUsers = { preHandler: requirePermission(services.identity, "USERS_MANAGE") };

    app.get("/api/users", manageUsers, async () => services.identity.listUsers());

    app.post<{ Body: CreateUserInput }>("/api/users", manageUsers, async (request, reply) => {
      try {
        return await services.identity.createUser(request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.patch<{ Params: { id: string }; Body: UpdateUserInput }>("/api/users/:id", manageUsers, async (request, reply) => {
      try {
        return await services.identity.updateUser(request.params.id, request.body, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.delete<{ Params: { id: string } }>("/api/users/:id", manageUsers, async (request, reply) => {
      try {
        return await services.identity.deleteUser(request.params.id, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
