import type { FastifyInstance } from "fastify";
import type { CashMovementFilter, CashMovementType, Denominaciones, PaymentMethod, UpdateShiftTemplateInput } from "@casacarlos/contracts";
import type { Services } from "../index.js";
import { requirePermission } from "../auth.js";

export function cashboxRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requirePermission(services.identity, "CASHBOX_MANAGE") };

    app.get("/api/cashbox/templates", auth, async () => services.cashbox.listShiftTemplates());

    app.post<{ Body: { nombre: string; horaInicio: string; horaFin: string; orden?: number } }>("/api/cashbox/templates", auth, async (request, reply) => {
      try {
        return await services.cashbox.createShiftTemplate(request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.put<{ Params: { id: string }; Body: UpdateShiftTemplateInput }>("/api/cashbox/templates/:id", auth, async (request, reply) => {
      try {
        return await services.cashbox.updateShiftTemplate(request.params.id, request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.patch<{ Params: { id: string }; Body: UpdateShiftTemplateInput }>("/api/cashbox/templates/:id", auth, async (request, reply) => {
      try {
        return await services.cashbox.updateShiftTemplate(request.params.id, request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.delete<{ Params: { id: string } }>("/api/cashbox/templates/:id", auth, async (request, reply) => {
      try {
        await services.cashbox.deleteShiftTemplate(request.params.id);
        return reply.code(204).send();
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: UpdateShiftTemplateInput }>("/api/cashbox/templates/:id", auth, async (request, reply) => {
      try {
        return await services.cashbox.updateShiftTemplate(request.params.id, request.body);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string } }>("/api/cashbox/templates/:id/delete", auth, async (request, reply) => {
      try {
        await services.cashbox.deleteShiftTemplate(request.params.id);
        return reply.code(204).send();
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get("/api/cashbox/shifts/mine", auth, async (request) => services.cashbox.getOpenShiftForUser(request.user!.id));

    app.get<{ Querystring: { desde?: string; hasta?: string } }>("/api/cashbox/shifts", auth, async (request) => {
      const { desde, hasta } = request.query;
      return services.cashbox.listShifts(desde && hasta ? { desde, hasta } : undefined);
    });

    app.get<{ Params: { id: string } }>("/api/cashbox/shifts/:id", auth, async (request, reply) => {
      try {
        return await services.cashbox.getShift(request.params.id);
      } catch (err) {
        return reply.code(404).send({ error: (err as Error).message });
      }
    });

    app.post<{ Body: { plantillaId?: string | null; aperturaCentimos: number } }>("/api/cashbox/shifts/open", auth, async (request, reply) => {
      try {
        return await services.cashbox.openShift({ ...request.body, usuarioId: request.user!.id });
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { denominaciones: Denominaciones; justificacion?: string | null } }>(
      "/api/cashbox/shifts/:id/close",
      auth,
      async (request, reply) => {
        try {
          return await services.cashbox.closeShift({ turnoId: request.params.id, usuarioId: request.user!.id, ...request.body });
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.post<{ Params: { id: string }; Body: { tipo: "INGRESO" | "EGRESO" | "AJUSTE"; montoCentimos: number; motivo: string } }>(
      "/api/cashbox/shifts/:id/movements",
      auth,
      async (request, reply) => {
        try {
          return await services.cashbox.addManualMovement({ turnoId: request.params.id, ...request.body, usuarioId: request.user!.id });
        } catch (err) {
          return reply.code(400).send({ error: (err as Error).message });
        }
      },
    );

    app.get<{ Params: { id: string } }>("/api/cashbox/shifts/:id/movements", auth, async (request) => services.cashbox.listMovements(request.params.id));

    app.get<{
      Querystring: { desde?: string; hasta?: string; tipo?: CashMovementType; metodo?: PaymentMethod };
    }>("/api/cashbox/movements", auth, async (request, reply) => {
      try {
        const filter: CashMovementFilter = request.query;
        const movements = await services.cashbox.listAllMovements(filter);
        const userIds = [...new Set(movements.map((movement) => movement.usuarioId))];
        const users = await Promise.all(userIds.map((id) => services.identity.getUser(id).catch(() => null)));
        const names = new Map(users.filter(Boolean).map((user) => [user!.id, `${user!.nombres} ${user!.apellidos}`]));
        return movements.map((movement) => ({ ...movement, usuarioNombre: names.get(movement.usuarioId) ?? "Usuario no disponible" }));
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: { denominaciones: Denominaciones } }>("/api/cashbox/shifts/:id/arqueo", auth, async (request, reply) => {
      try {
        return await services.cashbox.registrarArqueo({ turnoId: request.params.id, denominaciones: request.body.denominaciones, usuarioId: request.user!.id });
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get<{ Params: { id: string } }>("/api/cashbox/shifts/:id/arqueos", auth, async (request) => {
      const arqueos = await services.cashbox.listArqueos(request.params.id);
      const userIds = [...new Set(arqueos.map((a) => a.usuarioId))];
      const users = await Promise.all(userIds.map((uid) => services.identity.getUser(uid).catch(() => null)));
      const userMap = new Map(users.filter(Boolean).map((u) => [u!.id, `${u!.nombres} ${u!.apellidos}`.trim()]));
      return arqueos.map((a) => ({
        ...a,
        usuarioNombre: userMap.get(a.usuarioId) ?? "Recepcionista",
      }));
    });

    app.get<{ Params: { id: string } }>("/api/cashbox/arqueos/:id/ticket-data", auth, async (request, reply) => {
      try {
        const arqueo = await services.cashbox.getArqueo(request.params.id);
        if (!arqueo) return reply.code(404).send({ error: "Arqueo no encontrado" });

        const shift = await services.cashbox.getShift(arqueo.turnoId);
        const summary = await services.cashbox.getShiftSummary(arqueo.turnoId);
        const templates = await services.cashbox.listShiftTemplates();
        const plantilla = shift.plantillaId ? templates.find((t) => t.id === shift.plantillaId) ?? null : null;

        const [realizadoUser, abiertoUser] = await Promise.all([
          services.identity.getUser(arqueo.usuarioId).catch(() => null),
          services.identity.getUser(shift.usuarioId).catch(() => null),
        ]);

        const realizadoPor = {
          id: arqueo.usuarioId,
          nombre: realizadoUser ? `${realizadoUser.nombres} ${realizadoUser.apellidos}`.trim() : "Recepcionista",
        };

        const abiertoPor = {
          id: shift.usuarioId,
          nombre: abiertoUser ? `${abiertoUser.nombres} ${abiertoUser.apellidos}`.trim() : "Recepcionista",
        };

        const emisor = services.sunatConfig.read(services.sunatModoActivo).emisor;

        return {
          arqueo,
          shift,
          plantilla,
          summary,
          realizadoPor,
          abiertoPor,
          emisor,
        };
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get<{ Params: { id: string } }>("/api/cashbox/shifts/:id/summary", auth, async (request, reply) => {
      try {
        return await services.cashbox.getShiftSummary(request.params.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get<{ Params: { id: string } }>("/api/cashbox/shifts/:id/cuadre", auth, async (request, reply) => {
      try {
        const shiftId = request.params.id;
        const shift = await services.cashbox.getShift(shiftId);
        const summary = await services.cashbox.getShiftSummary(shiftId);
        const movements = await services.cashbox.listMovements(shiftId);
        const templates = await services.cashbox.listShiftTemplates();
        const plantilla = shift.plantillaId ? templates.find((t) => t.id === shift.plantillaId) ?? null : null;

        const userIds = [...new Set([shift.usuarioId, ...movements.map((m) => m.usuarioId)])];
        const users = await Promise.all(userIds.map((uid) => services.identity.getUser(uid).catch(() => null)));
        const userMap = new Map(users.filter(Boolean).map((u) => [u!.id, `${u!.nombres} ${u!.apellidos}`.trim()]));

        const abiertoPor = {
          id: shift.usuarioId,
          nombre: userMap.get(shift.usuarioId) ?? "Usuario desconocido",
        };

        const cierreMovement = movements.slice().reverse().find((m) => m.tipo === "CIERRE");
        const cerradoPor = shift.cerradoEn
          ? {
              id: cierreMovement ? cierreMovement.usuarioId : shift.usuarioId,
              nombre: (cierreMovement ? userMap.get(cierreMovement.usuarioId) : userMap.get(shift.usuarioId)) ?? "Usuario desconocido",
            }
          : null;

        const intervinientesMap = new Map<string, { id: string; nombre: string; operaciones: number; montoTotalCentimos: number }>();
        for (const m of movements) {
          const uId = m.usuarioId;
          const uNombre = userMap.get(uId) ?? "Usuario";
          const prev = intervinientesMap.get(uId) ?? { id: uId, nombre: uNombre, operaciones: 0, montoTotalCentimos: 0 };
          prev.operaciones += 1;
          if (m.tipo === "VENTA" || m.tipo === "INGRESO") {
            prev.montoTotalCentimos += m.montoCentimos;
          }
          intervinientesMap.set(uId, prev);
        }

        const emisor = services.sunatConfig.read(services.sunatModoActivo).emisor;

        const arqueos = await services.cashbox.listArqueos(shiftId);
        const ultimoArqueo = arqueos.length > 0 ? arqueos[0] : null;

        const effectiveShift = {
          ...shift,
          efectivoEsperadoCentimos: shift.efectivoEsperadoCentimos ?? summary.efectivoEsperadoCentimos,
          efectivoDeclaradoCentimos: shift.efectivoDeclaradoCentimos ?? (ultimoArqueo ? ultimoArqueo.totalCentimos : null),
          diferenciaCentimos: shift.diferenciaCentimos ?? (ultimoArqueo ? ultimoArqueo.diferenciaCentimos : null),
          denominacionesCierre: shift.denominacionesCierre ?? (ultimoArqueo ? ultimoArqueo.denominaciones : null),
        };

        return {
          shift: effectiveShift,
          plantilla,
          summary,
          abiertoPor,
          cerradoPor,
          intervinientes: Array.from(intervinientesMap.values()),
          emisor,
          esCorteProvisional: shift.estado === "ABIERTO",
          ultimoArqueo,
        };
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get<{ Querystring: { desde: string; hasta: string } }>("/api/cashbox/summary", auth, async (request, reply) => {
      try {
        return await services.cashbox.getRangeSummary(request.query);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });
  };
}
