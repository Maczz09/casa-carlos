import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";
import { requireAuth } from "../auth.js";

export function roomsRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAuth(services.identity) };

    app.get("/api/rooms/board", auth, async () => services.rooms.getBoard(false));

    app.get("/api/rooms/floors", auth, async () => services.rooms.listFloors());
    app.post<{ Body: { numero: number; nombre: string; orden: number } }>("/api/rooms/floors", auth, async (request, reply) => {
      try {
        return await services.rooms.createFloor(request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get("/api/rooms/attributes", auth, async () => services.rooms.listAttributes());
    app.post<{ Body: { nombre: string } }>("/api/rooms/attributes", auth, async (request, reply) => {
      try {
        return await services.rooms.createAttribute(request.body.nombre);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get("/api/rooms/categories", auth, async () => services.rooms.listCategories());

    app.post<{ Body: { nombre: string; descripcion?: string | null; camas?: number; ventiladores?: number; atributoIds?: string[] } }>(
      "/api/rooms/categories",
      auth,
      async (request, reply) => {
        try {
          return await services.rooms.createCategory(request.body);
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.patch<{
      Params: { id: string };
      Body: { nombre?: string; descripcion?: string | null; camas?: number; ventiladores?: number; atributoIds?: string[]; activo?: boolean };
    }>("/api/rooms/categories/:id", auth, async (request, reply) => {
      try {
        return await services.rooms.updateCategory(request.params.id, request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.delete<{ Params: { id: string } }>("/api/rooms/categories/:id", auth, async (request, reply) => {
      try {
        await services.rooms.deleteCategory(request.params.id);
        return reply.code(204).send();
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get("/api/rooms/all", auth, async () => services.rooms.listAllRooms());
    app.get("/api/rooms", auth, async () => services.rooms.listRooms());

    app.post<{ Body: { numero: string; pisoId: string; categoriaId: string; descripcion?: string | null; incluye?: string | null } }>(
      "/api/rooms",
      auth,
      async (request, reply) => {
        try {
          return await services.rooms.createRoom(request.body);
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.patch<{
      Params: { id: string };
      Body: { numero?: string; pisoId?: string; categoriaId?: string; descripcion?: string | null; incluye?: string | null; activo?: boolean };
    }>("/api/rooms/:id", auth, async (request, reply) => {
      try {
        return await services.rooms.updateRoom(request.params.id, request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.delete<{ Params: { id: string } }>("/api/rooms/:id", auth, async (request, reply) => {
      try {
        await services.rooms.deleteRoom(request.params.id);
        return reply.code(204).send();
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { minutes?: number } }>("/api/rooms/:id/cleaning", auth, async (request, reply) => {
      try {
        return await services.rooms.markCleaning(request.params.id, request.user!.id, request.body?.minutes);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string } }>("/api/rooms/:id/cleaning/finish", auth, async (request, reply) => {
      try {
        return await services.rooms.finishCleaning(request.params.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { motivo: string } }>("/api/rooms/:id/out-of-service", auth, async (request, reply) => {
      try {
        return await services.rooms.setOutOfService(request.params.id, request.body.motivo, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string } }>("/api/rooms/:id/return-to-service", auth, async (request, reply) => {
      try {
        return await services.rooms.returnToService(request.params.id, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
