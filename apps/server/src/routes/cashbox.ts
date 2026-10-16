import type { FastifyInstance } from "fastify";
import type { CashMovementFilter, CashMovementType, Denominaciones, PaymentMethod, UpdateShiftTemplateInput } from "@casacarlos/contracts";
import type { Services } from "../index.js";
import { requirePermission } from "../auth.js";

export function cashboxRoutes(services: Services) {
  return async function (app: FastifyInstance) {
    const auth = { preHandler: requirePermission(services.identity, "CASHBOX_MANAGE") };

    app.get("/api/cashbox/templates", auth, async () => services.cashbox.listShiftTemplates());
    app.post("/api/cashbox/templates/standard", auth, async (request, reply) => {
      try { return await services.cashbox.applyStandardSchedule(request.user!.id); }
      catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
    });

    app.post<{ Body: { nombre: string; horaInicio: string; horaFin: string; orden?: number } }>("/api/cashbox/templates", auth, async (request, reply) => {
      try {
        return await services.cashbox.createShiftTemplate(request.body, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.put<{ Params: { id: string }; Body: UpdateShiftTemplateInput }>("/api/cashbox/templates/:id", auth, async (request, reply) => {
      try {
        return await services.cashbox.updateShiftTemplate(request.params.id, request.body, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.patch<{ Params: { id: string }; Body: UpdateShiftTemplateInput }>("/api/cashbox/templates/:id", auth, async (request, reply) => {
      try {
        return await services.cashbox.updateShiftTemplate(request.params.id, request.body, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.delete<{ Params: { id: string } }>("/api/cashbox/templates/:id", auth, async (request, reply) => {
      try {
        await services.cashbox.deleteShiftTemplate(request.params.id, request.user!.id);
        return reply.code(204).send();
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string }; Body: UpdateShiftTemplateInput }>("/api/cashbox/templates/:id", auth, async (request, reply) => {
      try {
        return await services.cashbox.updateShiftTemplate(request.params.id, request.body, request.user!.id);
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.post<{ Params: { id: string } }>("/api/cashbox/templates/:id/delete", auth, async (request, reply) => {
      try {
        await services.cashbox.deleteShiftTemplate(request.params.id, request.user!.id);
        return reply.code(204).send();
      } catch (err) {
        return reply.code(400).send({ error: (err as Error).message });
      }
    });

    app.get("/api/cashbox/shifts/mine", auth, async () => services.cashbox.getOpenShift());
    app.get("/api/cashbox/shifts/current", auth, async () => services.cashbox.getOpenShift());
    app.get("/api/cashbox/shifts/legacy", auth, async () => services.cashbox.getLegacyOpenShifts());
    app.get("/api/cashbox/automation", auth, async () => services.cashbox.getAutomation());
    app.put<{ Body: { habilitado: boolean } }>("/api/cashbox/automation", auth, async (request, reply) => {
      if (typeof request.body?.habilitado !== "boolean") return reply.code(400).send({ error: "Indica si los relevos automáticos están habilitados." });
      try { return await services.cashbox.setAutomation(request.body.habilitado, request.user!.id); }
      catch (err) { return reply.code(400).send({ error: (err as Error).message }); }
    });

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
        return movements.map((movement) => ({ ...movement, usuarioNombre: names.get(movement.usuarioId) ?? (movement.usuarioId === "system" ? "Sistema automático" : "Usuario no disponible") }));
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
        userMap.set("system", "Sistema automático");
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
        const plantilla = shift.plantillaId ? await services.cashbox.getShiftTemplate(shift.plantillaId) : null;

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
        const plantilla = shift.plantillaId ? await services.cashbox.getShiftTemplate(shift.plantillaId) : null;

        const userIds = [...new Set([shift.usuarioId, ...movements.map((m) => m.usuarioId)])];
        const users = await Promise.all(userIds.map((uid) => services.identity.getUser(uid).catch(() => null)));
        const userMap = new Map(users.filter(Boolean).map((u) => [u!.id, `${u!.nombres} ${u!.apellidos}`.trim()]));
        userMap.set("system", "Sistema automático");

        const abiertoPor = {
          id: shift.usuarioId,
          nombre: userMap.get(shift.usuarioId) ?? "Usuario desconocido",
        };

        const cierreMovement = movements.slice().reverse().find((m) => m.tipo === "CIERRE" || m.tipo === "TRASPASO_SALIDA");
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
          if (m.tipo === "ANULACION" || m.tipo === "DEVOLUCION") prev.montoTotalCentimos -= m.montoCentimos;
          if (m.tipo === "VENTA" || m.tipo === "INGRESO") {
            prev.montoTotalCentimos += m.montoCentimos;
          }
          intervinientesMap.set(uId, prev);
        }

        const emisor = services.sunatConfig.read(services.sunatModoActivo).emisor;

        const arqueos = await services.cashbox.listArqueos(shiftId);
        const ultimoArqueo = shift.estado === "ABIERTO" && arqueos.length > 0 ? arqueos[0] : null;

        const effectiveShift = {
          ...shift,
          efectivoEsperadoCentimos: shift.efectivoEsperadoCentimos ?? summary.efectivoEsperadoCentimos,
          efectivoDeclaradoCentimos: shift.efectivoDeclaradoCentimos ?? (ultimoArqueo ? ultimoArqueo.totalCentimos : null),
          diferenciaCentimos: shift.diferenciaCentimos ?? (ultimoArqueo ? ultimoArqueo.diferenciaCentimos : null),
          denominacionesCierre: shift.denominacionesCierre ?? (ultimoArqueo ? ultimoArqueo.denominaciones : null),
        };

        const saleMovements = movements.filter((m) => (m.tipo === "VENTA" || m.tipo === "ANULACION" || m.tipo === "DEVOLUCION" || m.tipo === "CORRECCION") && m.ventaId);
        const ventaIds = [...new Set(saleMovements.map((m) => m.ventaId!))];

        const rawVentasDetalle = await Promise.all(
          ventaIds.map(async (ventaId) => {
            const history = await services.sales.getSaleHistory(ventaId);
            const sale = history.venta;
            if (!sale) return null;

            const saleEntries = movements.filter((m) => m.ventaId === ventaId);
            const paymentIds = new Set(saleEntries.filter((m) => m.tipo === "VENTA").map((m) => m.pagoId));
            const payments = history.pagos.filter((p) => p.estado === "ACEPTADO" && paymentIds.has(p.id));
            const allDetalles = payments.flatMap((p) => p.detalles);
            const cobros = payments.flatMap((p) => p.detalles.map((d) => ({ ...d, usuarioNombre: p.usuarioNombre, usuarioId: p.aceptadoPor, aceptadoEn: p.aceptadoEn })));

            const metodosPago = [...new Set(allDetalles.map((d) => d.metodo))];

            const cashDetails = allDetalles.filter((d) => d.metodo === "EFECTIVO");
            const recibidoCentimos = cashDetails.reduce((sum, d) => sum + (d.recibidoCentimos ?? d.montoCentimos), 0);
            const vueltoCentimos = cashDetails.reduce((sum, d) => sum + (d.vueltoCentimos ?? 0), 0);

            const activeLines = sale.lineas.filter((l) => !l.anulada);

            const hospedajeLines = activeLines.filter((l) => l.tipo === "HOSPEDAJE");
            const hospedajeDescripcion = hospedajeLines.map((l) => l.descripcion).join(", ") || null;
            const hospedajeMontoCentimos = hospedajeLines.reduce((sum, l) => sum + l.subtotalCentimos, 0);

            const horasExtra = activeLines
              .filter(
                (l) =>
                  l.tipo === "CARGO_EXTRA" &&
                  (l.referenciaId === "EXCESO_TIEMPO" ||
                    /exceso|hora.*extra/i.test(l.descripcion)),
              )
              .map((l) => ({
                descripcion: l.descripcion,
                cantidad: l.cantidad,
                subtotalCentimos: l.subtotalCentimos,
              }));

            const productos = activeLines
              .filter((l) => l.tipo === "PRODUCTO")
              .map((l) => ({
                descripcion: l.descripcion,
                cantidad: l.cantidad,
                subtotalCentimos: l.subtotalCentimos,
              }));

            const otrosCargos = activeLines
              .filter(
                (l) =>
                  l.tipo === "CARGO_EXTRA" &&
                  l.referenciaId !== "EXCESO_TIEMPO" &&
                  !/exceso|hora.*extra/i.test(l.descripcion),
              )
              .map((l) => ({
                descripcion: l.descripcion,
                cantidad: l.cantidad,
                subtotalCentimos: l.subtotalCentimos,
              }));

            return {
              ventaId: sale.id,
              estado: sale.estado,
              cerradaEn: sale.cerradaEn,
              cobradoTurnoCentimos: saleEntries.filter((m) => m.tipo === "VENTA").reduce((sum, m) => sum + m.montoCentimos, 0),
              devueltoTurnoCentimos: saleEntries.filter((m) => m.tipo === "DEVOLUCION").reduce((sum, m) => sum + m.montoCentimos, 0),
              anuladoTurnoCentimos: saleEntries.filter((m) => m.tipo === "ANULACION").reduce((sum, m) => sum + m.montoCentimos, 0),
              cobros,
              serie: sale.serie,
              correlativo: sale.correlativo,
              cuartoNumero: sale.cuartoNumero ?? null,
              clienteNombre: [sale.clienteNombres, sale.clienteApellidos].filter(Boolean).join(" ").trim() || "Cliente",
              clienteDni: sale.clienteDni ?? null,
              totalCentimos: sale.totalCentimos,
              pagadoCentimos: sale.pagadoCentimos,
              saldoCentimos: sale.saldoCentimos,
              metodosPago,
              recibidoCentimos: recibidoCentimos > 0 ? recibidoCentimos : null,
              vueltoCentimos: vueltoCentimos > 0 ? vueltoCentimos : null,
              hospedajeDescripcion,
              hospedajeMontoCentimos,
              cargosAnulados: sale.lineas.filter((l) => l.anulada).map((l) => ({ descripcion: l.descripcion, cantidad: l.cantidad, subtotalCentimos: l.subtotalCentimos, motivo: l.motivoAnulacion })),
              horasExtra,
              productos,
              otrosCargos,
              creadoEn: sale.creadoEn,
            };
          }),
        );

        const ventasDetalle = rawVentasDetalle.filter(Boolean) as NonNullable<(typeof rawVentasDetalle)[number]>[];

        const totalesConceptos = {
          totalHospedajeCentimos: ventasDetalle.reduce((sum, v) => sum + v.hospedajeMontoCentimos, 0),
          totalHorasExtraCentimos: ventasDetalle.reduce(
            (sum, v) => sum + v.horasExtra.reduce((s, h) => s + h.subtotalCentimos, 0),
            0,
          ),
          totalProductosCentimos: ventasDetalle.reduce(
            (sum, v) => sum + v.productos.reduce((s, p) => s + p.subtotalCentimos, 0),
            0,
          ),
          totalOtrosCargosCentimos: ventasDetalle.reduce(
            (sum, v) => sum + v.otrosCargos.reduce((s, c) => s + c.subtotalCentimos, 0),
            0,
          ),
          totalVueltosCentimos: summary.vueltosCentimos,
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
          ventasDetalle,
          movimientos: movements.map((m) => ({ ...m, usuarioNombre: userMap.get(m.usuarioId) ?? m.usuarioId })),
          totalesConceptos,
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
