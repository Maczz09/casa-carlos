import type { FastifyInstance } from "fastify";
import type { Services } from "../index.js";

/**
 * No auth on this router — the kiosk terminal has no login (see
 * docs/ARQUITECTURA.md §9, kiosco = token de dispositivo, sin persona). It
 * only ever reads or writes its own in-progress session, which never
 * carries other guests' data (rooms.getBoard(true) strips names).
 */
export function kioskPublicRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    app.get("/api/kiosk/current", async () => services.kiosk.getCurrent());
    app.get("/api/kiosk/board", async () => services.rooms.getBoard(true));
    app.get("/api/kiosk/floors", async () => services.rooms.listFloors());
    app.get("/api/kiosk/categories", async () => services.rooms.listCategories());
    app.get("/api/kiosk/attributes", async () => services.rooms.listAttributes());
    app.get("/api/kiosk/collection-accounts", async () => services.payments.listCollectionAccounts());
    app.get("/api/kiosk/modalities", async () => services.pricing.listModalities());

    // Solo lo que el huésped necesita para decidir — sin costoCentimos/stock exacto (dato de negocio, ver KioskProductSchema).
    // Se listan también los agotados (enStock: false) para que el huésped vea el catálogo completo, no que "desaparezcan" productos.
    app.get("/api/kiosk/products", async () => {
      const products = await services.inventory.listProducts();
      return products
        .filter((p) => p.activo && p.estado !== "DESCONTINUADO")
        .map((p) => ({
          id: p.id,
          nombre: p.nombre,
          descripcion: p.descripcion,
          categoria: p.categoria,
          precioCentimos: p.precioCentimos,
          enStock: p.estado !== "AGOTADO" && p.stock > 0,
          imagenes: p.imagenes.map((image) => image.url),
        }));
    });

    app.post<{ Body: { pisoId: string } }>("/api/kiosk/select-floor", async (request, reply) => {
      try {
        return await services.kiosk.selectFloor(request.body.pisoId);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Body: { cuartoId: string } }>("/api/kiosk/select-room", async (request, reply) => {
      try {
        return await services.kiosk.selectRoom(request.body.cuartoId);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Body: { productoId: string; cantidad?: number } }>("/api/kiosk/add-product", async (request, reply) => {
      try {
        return await services.kiosk.addProduct(request.body.productoId, request.body.cantidad ?? 1);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post("/api/kiosk/finish-products", async (request, reply) => {
      try {
        return await services.kiosk.finishProducts();
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Body: { detalles: { metodo: string; montoCentimos: number }[] } }>("/api/kiosk/propose-payment", async (request, reply) => {
      try {
        return await services.kiosk.proposePayment(request.body.detalles);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post("/api/kiosk/reset", async (request, reply) => {
      try {
        await services.kiosk.reset("Reiniciado desde el kiosco");
        return { ok: true };
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
