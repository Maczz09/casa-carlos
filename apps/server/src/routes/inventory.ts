import type { FastifyInstance } from "fastify";
import type { ProductState } from "@casacarlos/contracts";
import type { Services } from "../index.js";
import { requireAuth } from "../auth.js";

export function inventoryRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAuth(services.identity) };

    app.get("/api/inventory/products", auth, async () => services.inventory.listProducts());
    app.get("/api/inventory/low-stock", auth, async () => services.inventory.listLowStock());

    app.get("/api/inventory/categories", auth, async () => services.inventory.listCategories());

    app.post<{ Body: { nombre: string; descripcion?: string | null } }>("/api/inventory/categories", auth, async (request, reply) => {
      try {
        return await services.inventory.createCategory(request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.patch<{ Params: { id: string }; Body: { nombre?: string; descripcion?: string | null; activo?: boolean } }>(
      "/api/inventory/categories/:id",
      auth,
      async (request, reply) => {
        try {
          return await services.inventory.updateCategory(request.params.id, request.body);
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.delete<{ Params: { id: string } }>("/api/inventory/categories/:id", auth, async (request, reply) => {
      try {
        await services.inventory.deleteCategory(request.params.id);
        return reply.code(204).send();
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get<{ Params: { id: string } }>("/api/inventory/products/:id", auth, async (request, reply) => {
      try {
        return await services.inventory.getProduct(request.params.id);
      } catch (err) {
        return reply.code(404).send({ error: (err as Error).message });
      }
    });

    app.get<{ Params: { code: string } }>("/api/inventory/products/barcode/:code", auth, async (request) => {
      return services.inventory.findByBarcode(request.params.code);
    });

    app.get<{ Params: { id: string } }>("/api/inventory/products/:id/movements", auth, async (request) => {
      return services.inventory.listMovements(request.params.id);
    });

    app.post<{
      Body: {
        codigoBarras?: string | null;
        nombre: string;
        descripcion?: string | null;
        categoriaId?: string | null;
        precioCentimos: number;
        costoCentimos?: number;
        stockInicial?: number;
        stockMinimo?: number;
      };
    }>("/api/inventory/products", auth, async (request, reply) => {
      try {
        return await services.inventory.createProduct({ ...request.body, usuarioId: request.user!.id });
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.patch<{
      Params: { id: string };
      Body: {
        nombre?: string;
        descripcion?: string | null;
        categoriaId?: string | null;
        precioCentimos?: number;
        costoCentimos?: number;
        stockMinimo?: number;
        estado?: ProductState;
      };
    }>("/api/inventory/products/:id", auth, async (request, reply) => {
      try {
        return await services.inventory.updateProduct(request.params.id, request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { cantidad: number; motivo: string } }>(
      "/api/inventory/products/:id/stock-in",
      auth,
      async (request, reply) => {
        try {
          return await services.inventory.registerStockIn({ productoId: request.params.id, cantidad: request.body.cantidad, motivo: request.body.motivo, usuarioId: request.user!.id });
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.post<{ Params: { id: string }; Body: { cantidad: number; motivo: string } }>(
      "/api/inventory/products/:id/adjust",
      auth,
      async (request, reply) => {
        try {
          return await services.inventory.adjustStock({ productoId: request.params.id, cantidad: request.body.cantidad, motivo: request.body.motivo, usuarioId: request.user!.id });
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );
  };
}
