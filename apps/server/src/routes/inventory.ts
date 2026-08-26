import type { FastifyInstance } from "fastify";
import type { ProductState } from "@casacarlos/contracts";
import type { Services } from "../index.js";
import { requireAdmin, requireAuth } from "../auth.js";

export function inventoryRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requireAuth(services.identity) };
    const admin = { preHandler: requireAdmin(services.identity) };

    app.get("/api/inventory/products", auth, async () => services.inventory.listProducts());
    app.get("/api/inventory/low-stock", auth, async () => services.inventory.listLowStock());

    app.get("/api/inventory/categories", auth, async () => services.inventory.listCategories());

    app.post<{ Body: { nombre: string; descripcion?: string | null } }>("/api/inventory/categories", admin, async (request, reply) => {
      try {
        return await services.inventory.createCategory(request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.patch<{ Params: { id: string }; Body: { nombre?: string; descripcion?: string | null; activo?: boolean } }>(
      "/api/inventory/categories/:id",
      admin,
      async (request, reply) => {
        try {
          return await services.inventory.updateCategory(request.params.id, request.body);
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.delete<{ Params: { id: string } }>("/api/inventory/categories/:id", admin, async (request, reply) => {
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
    }>("/api/inventory/products", admin, async (request, reply) => {
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
    }>("/api/inventory/products/:id", admin, async (request, reply) => {
      try {
        return await services.inventory.updateProduct(request.params.id, request.body, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    // Recepción puede corregir precios sin obtener permisos sobre nombre,
    // costo, categoría, stock o imágenes. El endpoint separado evita que
    // esa regla dependa de ocultar campos en el frontend.
    app.patch<{ Params: { id: string }; Body: { precioCentimos: number } }>("/api/inventory/products/:id/price", auth, async (request, reply) => {
      try {
        return await services.inventory.updateProductPrice(request.params.id, request.body.precioCentimos, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string } }>("/api/inventory/products/:id/images", admin, async (request, reply) => {
      let stored: { archivo: string; mimeType: "image/jpeg" | "image/png" | "image/webp"; tamanoBytes: number } | null = null;
      try {
        const part = await request.file();
        if (!part) return reply.code(400).send({ error: "Selecciona una imagen para subir." });
        const buffer = await part.toBuffer();
        stored = services.productImages.save(buffer);
        const image = await services.inventory.addProductImage({ productoId: request.params.id, ...stored, usuarioId: request.user!.id });
        return reply.code(201).send(image);
      } catch (err) {
        if (stored) {
          try {
            services.productImages.delete(stored.archivo);
          } catch {
            // Un archivo huérfano es preferible a ocultar el error original.
          }
        }
        const message = (err as Error).message;
        return reply.code(message.includes("límite") || message.includes("File too large") ? 413 : 400).send({ error: message });
      }
    });

    app.patch<{ Params: { id: string }; Body: { imageIds: string[] } }>("/api/inventory/products/:id/images/order", admin, async (request, reply) => {
      try {
        return await services.inventory.reorderProductImages(request.params.id, request.body.imageIds, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.delete<{ Params: { id: string; imageId: string } }>("/api/inventory/products/:id/images/:imageId", admin, async (request, reply) => {
      try {
        const image = await services.inventory.deleteProductImage(request.params.id, request.params.imageId, request.user!.id);
        services.productImages.delete(image.archivo);
        return reply.code(204).send();
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { cantidad: number; motivo: string } }>(
      "/api/inventory/products/:id/stock-in",
      admin,
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
      admin,
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
