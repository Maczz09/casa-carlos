import { createHash } from "node:crypto";
import type { Db } from "@casacarlos/db";
import { afterCommit, atomic, recordAudit, schema } from "@casacarlos/db";
import { and, eq, inArray } from "drizzle-orm";
import { newId } from "@casacarlos/contracts";
import type {
  AddExtraChargeInput,
  AddExtraHoursInput,
  AddProductLineInput,
  CancelledSale,
  CheckoutConfirmation,
  CheckoutPreview,
  CheckoutResult,
  PaymentMethod,
  CancelSaleInput,
  InventoryPort,
  LinePhase,
  OpenSaleForStayInput,
  PricingPort,
  Sale,
  SaleHistory,
  SaleLine,
  SalesPort,
  SaleWithLines,
  RoomsPort,
  StaysPort,
  Stay,
} from "@casacarlos/contracts";
import type { EventBus } from "@casacarlos/bus";
import { SalesRepo } from "./repo.js";
import { computeBlocks } from "./domain/hosting-price.js";

const DEFAULT_SERIE = "B001";

export class SalesService implements SalesPort {
  private readonly repo: SalesRepo;

  constructor(
    private readonly db: Db,
    private readonly bus: EventBus,
    private readonly rooms: RoomsPort,
    private readonly pricing: PricingPort,
    private readonly stays: StaysPort,
    private readonly inventory: InventoryPort,
  ) {
    this.repo = new SalesRepo(db);

    this.bus.subscribe("stay.overstayed", async ({ stayId }) => {
      try {
        await this.syncOverstayCharge(stayId);
      } catch (err) {
        console.error(`[sales] Error al sincronizar recargo por exceso para estadía ${stayId}:`, err);
      }
    });
  }

  async openSaleForStay(input: OpenSaleForStayInput): Promise<Sale> {
    return atomic(this.db, async () => {
      const stay = await this.stays.getStay(input.stayId);
      const room = await this.rooms.getRoom(stay.cuartoId);
      const modality = await this.pricing.getModality(stay.modalidadId);

      let cantidad: number;
      let precioUnitarioCentimos: number;
      let descripcion: string;

      if (modality.checkinFijo) {
        const noches = stay.noches || 1;
        precioUnitarioCentimos = await this.pricing.resolveNightScalePrice({
          modalidadId: stay.modalidadId,
          categoriaId: room.categoriaId,
          noches,
        });
        cantidad = 1;
        descripcion = `Hospedaje ${modality.nombre} — ${noches} noche(s)`;
      } else {
        const blocks = computeBlocks(modality, stay.checkinPrevisto, stay.checkoutPrevisto);
        const rate = await this.pricing.resolveRate({
          categoriaId: room.categoriaId,
          modalidadId: stay.modalidadId,
          at: new Date(stay.checkinReal ?? stay.checkinPrevisto),
        });
        precioUnitarioCentimos = rate.precioCentimos;
        cantidad = blocks;
        descripcion = `Hospedaje ${modality.nombre} — ${blocks} bloque(s) de ${modality.duracionHoras}h`;
      }

      const subtotal = precioUnitarioCentimos * cantidad;
      const now = new Date().toISOString();
      const correlativo = await this.repo.nextCorrelativo(DEFAULT_SERIE);

      const sale = await this.repo.insertSale({
        id: newId(),
        serie: DEFAULT_SERIE,
        correlativo,
        tipo: "VENTA",
        estado: "ABIERTA",
        estadiaId: stay.id,
        cuartoId: stay.cuartoId,
        clienteNombres: stay.cliente.nombres,
        clienteApellidos: stay.cliente.apellidos,
        clienteDni: stay.cliente.dni,
        totalCentimos: subtotal,
        pagadoCentimos: 0,
        saldoCentimos: subtotal,
        usuarioId: input.usuarioId,
        pagadaEn: null,
        cerradaEn: null,
        motivoAnulacion: null,
        creadoEn: now,
      });

      const line = await this.repo.insertLine({
        id: newId(),
        ventaId: sale.id,
        tipo: "HOSPEDAJE",
        referenciaId: stay.modalidadId,
        descripcion,
        cantidad,
        precioUnitarioCentimos,
        subtotalCentimos: subtotal,
        fase: "PRE_PAGO",
        anulada: false,
        motivoAnulacion: null,
        usuarioId: input.usuarioId,
        creadoEn: now,
      });

      await recordAudit(this.db, { entidad: "sales_ventas", entidadId: sale.id, accion: "ABRIR", usuarioId: input.usuarioId, despues: sale });
      await this.bus.publish("sale.opened", { saleId: sale.id, usuarioId: input.usuarioId });
      await this.bus.publish("sale.line_added", { saleId: sale.id, lineId: line.id, phase: "PRE_PAGO" });
      return sale;
    });
  }

  async addExtraCharge(input: AddExtraChargeInput): Promise<SaleLine> {
    return atomic(this.db, async () => {
      const sale = await this.mustGet(input.saleId);
      const charge = await this.pricing.getCharge(input.codigo);
      const subtotal = charge.precioCentimos * input.cantidad;

      return this.appendLine(sale, {
        tipo: "CARGO_EXTRA",
        referenciaId: charge.id,
        descripcion: `${charge.nombre} × ${input.cantidad}`,
        cantidad: input.cantidad,
        precioUnitarioCentimos: charge.precioCentimos,
        subtotalCentimos: subtotal,
        usuarioId: input.usuarioId,
        auditAccion: "AGREGAR_CARGO",
      });
    });
  }

  async addExtraHours(input: AddExtraHoursInput): Promise<SaleLine> {
    return atomic(this.db, async () => {
      const sale = await this.mustGet(input.saleId);
      let unitPrice = input.precioUnitarioCentimos;
      if (unitPrice == null && sale.estadiaId) {
        const stay = await this.stays.getStay(sale.estadiaId).catch(() => null);
        if (stay) {
          const modality = await this.pricing.getModality(stay.modalidadId).catch(() => null);
          if (modality?.precioAdicionalCentimos) {
            unitPrice = modality.precioAdicionalCentimos;
          }
        }
      }
      if (unitPrice == null) unitPrice = 1000;
      if (!Number.isSafeInteger(input.horas) || input.horas <= 0 || !Number.isSafeInteger(unitPrice) || unitPrice <= 0) throw new Error("Las horas y el precio deben ser enteros positivos.");
      const subtotal = unitPrice * input.horas;
      const descripcion = `Hora(s) extra (${input.horas}h × S/ ${(unitPrice / 100).toFixed(2)})`;

      const line = await this.appendLine(sale, {
        tipo: "CARGO_EXTRA",
        referenciaId: "HORA_EXTRA_MANUAL",
        descripcion,
        cantidad: input.horas,
        precioUnitarioCentimos: unitPrice,
        subtotalCentimos: subtotal,
        usuarioId: input.usuarioId,
        auditAccion: "AGREGAR_HORA_EXTRA",
      });
      if (!sale.estadiaId) throw new Error("Las horas extra requieren una estadía activa.");
      await this.stays.extendByHours(sale.estadiaId, input.horas, input.usuarioId);
      await this.syncOverstayCharge(sale.estadiaId, new Date(), input.usuarioId);
      return line;
    });
  }

  async addProductLine(input: AddProductLineInput): Promise<SaleLine> {
    return atomic(this.db, async () => {
      const sale = await this.mustGet(input.saleId);
      const product = await this.inventory.getProduct(input.productoId);
      const subtotal = product.precioCentimos * input.cantidad;

      const line = await this.appendLine(sale, {
        tipo: "PRODUCTO",
        referenciaId: product.id,
        descripcion: `${product.nombre} × ${input.cantidad}`,
        cantidad: input.cantidad,
        precioUnitarioCentimos: product.precioCentimos,
        subtotalCentimos: subtotal,
        usuarioId: input.usuarioId,
        auditAccion: "AGREGAR_PRODUCTO",
      });

      await this.inventory.dispatch({
        productoId: product.id,
        cantidad: input.cantidad,
        cuartoId: sale.cuartoId,
        ventaId: sale.id,
        lineaVentaId: line.id,
        usuarioId: input.usuarioId,
      });

      return line;
    });
  }

  async cancelLine(saleId: string, lineId: string, motivo: string, usuarioId: string): Promise<void> {
    return atomic(this.db, async () => {
      const sale = await this.mustGet(saleId);
      this.assertEditable(sale);
      if (!motivo?.trim()) throw new Error("Indica el motivo de la anulación.");
      const line = await this.repo.getLine(lineId);
      if (!line || line.ventaId !== saleId) throw new Error(`Línea ${lineId} no encontrada en la venta ${saleId}.`);
      if (line.anulada) throw new Error("Esa línea ya está anulada.");

      const updated = await this.repo.updateLine(lineId, { anulada: true, motivoAnulacion: motivo });
      await this.recalcularTotales(saleId);

      if (line.tipo === "PRODUCTO") {
        await this.inventory.returnStock({ lineaVentaId: lineId, usuarioId, motivo });
      }

      await recordAudit(this.db, { entidad: "sales_lineas", entidadId: lineId, accion: "ANULAR_LINEA", usuarioId, antes: line, despues: updated, motivo });
    });
  }

  private async loadSaleDetails(id: string): Promise<SaleWithLines> {
    const sale = await this.mustGet(id);
    let cuartoNumero: string | null = null;
    if (sale.cuartoId) {
      try {
        const room = await this.rooms.getRoom(sale.cuartoId);
        cuartoNumero = room?.numero ?? null;
      } catch {
        // ignore
      }
    }
    return { ...sale, cuartoNumero, lineas: await this.repo.listLines(id, true) };
  }

  async getSale(id: string): Promise<SaleWithLines> {
    const sale = await this.mustGet(id);
    if (sale.estadiaId && !["CERRADA", "ANULADA"].includes(sale.estado)) {
      await this.syncOverstayCharge(sale.estadiaId);
    }
    return this.loadSaleDetails(id);
  }

  /** Consulta histórica: no recalcula cargos ni modifica ventas. */
  async getSaleHistory(id: string): Promise<SaleHistory> {
    const venta = await this.loadSaleDetails(id);
    const pagos = await this.db.select().from(schema.paymentsPagos).where(eq(schema.paymentsPagos.ventaId, id)).all();
    const pagoIds = pagos.map((p) => p.id);
    const detalles = pagoIds.length ? await this.db.select().from(schema.paymentsDetalles).where(inArray(schema.paymentsDetalles.pagoId, pagoIds)).all() : [];
    const movimientos = await this.db.select().from(schema.cashboxMovimientos).where(eq(schema.cashboxMovimientos.ventaId, id)).all();
    const turnoIds = [...new Set(movimientos.map((m) => m.turnoId))];
    const turnos = turnoIds.length ? await this.db.select().from(schema.cashboxTurnos).where(inArray(schema.cashboxTurnos.id, turnoIds)).all() : [];
    const users = await this.db.select().from(schema.identityUsuarios).all();
    const names = new Map(users.map((u) => [u.id, `${u.nombres} ${u.apellidos}`.trim() || u.usuario]));
    const name = (userId: string | null) => userId && userId !== "system" ? names.get(userId) ?? userId : "Sistema";
    const entityIds = [id, ...venta.lineas.map((l) => l.id), ...pagoIds, ...movimientos.map((m) => m.id), ...(venta.estadiaId ? [venta.estadiaId] : [])];
    const auditoria = await this.db.select().from(schema.auditLog).where(inArray(schema.auditLog.entidadId, entityIds)).all();
    return {
      venta,
      estadia: venta.estadiaId ? await this.stays.getStay(venta.estadiaId) : null,
      pagos: pagos.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn)).map((p) => ({ ...p, usuarioNombre: name(p.aceptadoPor), detalles: detalles.filter((d) => d.pagoId === p.id) })),
      movimientos: movimientos.sort((a, b) => a.ocurridoEn.localeCompare(b.ocurridoEn)).map((m) => ({ ...m, usuarioNombre: name(m.usuarioId) })),
      turnos: turnos.map(({ denominacionesCierreJson, ...t }) => ({ ...t, denominacionesCierre: denominacionesCierreJson ? JSON.parse(denominacionesCierreJson) : null })),
      auditoria: auditoria.sort((a, b) => a.ocurridoEn.localeCompare(b.ocurridoEn)).map((a) => ({ ...a, usuarioNombre: name(a.usuarioId) })),
    };
  }

  async getSaleForStay(stayId: string): Promise<SaleWithLines | null> {
    await this.syncOverstayCharge(stayId);
    const sale = await this.repo.getSaleByStay(stayId);
    if (!sale) return null;
    return this.loadSaleDetails(sale.id);
  }

  async checkOutStay(stayId: string, usuarioId: string, horaSalida?: string | null): Promise<Stay> {
    return atomic(this.db, async () => {
      const stay = await this.stays.getStay(stayId);
      const sale = await this.repo.getSaleByStay(stayId);
      if (stay.estado === "FINALIZADA" && sale?.estado === "CERRADA") return stay;
      if (!["EN_CURSO", "EN_TOLERANCIA", "EXCEDIDA"].includes(stay.estado)) throw new Error("La estadía no está activa.");
      if (!sale || sale.estado === "ANULADA") throw new Error("La estadía no tiene una venta vigente.");
      const exitTime = horaSalida ? new Date(horaSalida) : stay.salidaDeclaradaEn ? new Date(stay.salidaDeclaradaEn) : new Date();
      if (horaSalida && !stay.salidaDeclaradaEn && (await this.repo.listLines(sale.id)).some((l) => isHourLine(l))) throw new Error("Revisa y confirma la corrección de salida antes de anular horas extra.");
      if (!Number.isFinite(exitTime.getTime()) || exitTime.getTime() > Date.now() || exitTime < new Date(stay.checkinReal ?? stay.checkinPrevisto)) throw new Error("La hora de salida debe estar entre la entrada y el momento actual.");
      // Un solo corte: ninguna lectura vuelve a calcular al reloj actual.
      const finalSale = await this.syncOverstayCharge(stayId, exitTime);
      if (!finalSale || finalSale.saldoCentimos !== 0) throw new Error(finalSale && finalSale.saldoCentimos < 0 ? "La hora elegida deja un pago en exceso. Revisa los cobros antes de cerrar." : "Hay un saldo pendiente de S/ " + ((finalSale?.saldoCentimos ?? 0) / 100).toFixed(2) + ". Cóbralo antes del check-out.");
      const pending = await this.db.select().from(schema.paymentsPagos).where(and(eq(schema.paymentsPagos.ventaId, sale.id), eq(schema.paymentsPagos.estado, "PENDIENTE"))).get();
      if (pending) throw new Error("Resuelve el pago pendiente antes del check-out.");
      const updatedStay = await this.stays.checkOut(stayId, usuarioId, exitTime.toISOString());
      const updated = await this.repo.updateSale(sale.id, { estado: "CERRADA", cerradaEn: exitTime.toISOString() });
      await afterCommit(this.db, () => this.bus.publish("sale.closed", { saleId: sale.id }));
      await recordAudit(this.db, { entidad: "sales_ventas", entidadId: sale.id, accion: "CERRAR_CHECKOUT", usuarioId, antes: finalSale, despues: updated });
      return updatedStay;
    });
  }

  async previewCheckOut(stayId: string, horaSalida: string, anularHorasExtra: boolean): Promise<CheckoutPreview> {
    return atomic(this.db, async () => {
      const stay = await this.stays.getStay(stayId);
      const sale = await this.repo.getSaleByStay(stayId);
      if (!sale || !["EN_CURSO", "EN_TOLERANCIA", "EXCEDIDA"].includes(stay.estado) || ["CERRADA", "ANULADA"].includes(sale.estado)) throw new Error("La estadía no tiene una venta activa para revisar.");
      if (typeof anularHorasExtra !== "boolean") throw new Error("Indica si corresponde anular las horas extra.");
      const exitTime = new Date(horaSalida);
      if (!Number.isFinite(exitTime.getTime()) || exitTime.getTime() > Date.now() || exitTime < new Date(stay.checkinReal ?? stay.checkinPrevisto)) throw new Error("La salida debe estar entre la entrada y el momento actual.");
      const lines = await this.repo.listLines(sale.id, true);
      const active = lines.filter((l) => !l.anulada);
      const cambios: CheckoutPreview["cambios"] = [];
      if (anularHorasExtra) {
        for (const line of active.filter(isHourLine)) cambios.push({ lineaId: line.id, descripcion: line.descripcion, antesCentimos: line.subtotalCentimos, despuesCentimos: 0 });
      } else {
        const autoLines = lines.filter((l) => l.referenciaId === "EXCESO_TIEMPO");
        const existing = autoLines.find((l) => !l.anulada) ?? autoLines.at(-1);
        const waived = autoLines.some((l) => l.anulada && l.motivoAnulacion !== "Check-out dentro de tolerancia");
        if (!waived) {
          const modality = await this.pricing.getModality(stay.modalidadId);
          const unitPrice = existing?.precioUnitarioCentimos ?? modality.precioAdicionalCentimos;
          const interval = existing?.intervaloMinutos ?? modality.tiempoAdicionalMinutos ?? 60;
          const diff = exitTime.getTime() - Date.parse(stay.checkoutPrevisto) - stay.toleranciaMin * 60_000;
          const amount = diff > 0 && unitPrice > 0 && interval > 0 ? Math.ceil(diff / (interval * 60_000)) * unitPrice : 0;
          const before = existing && !existing.anulada ? existing.subtotalCentimos : 0;
          if (before !== amount) cambios.push({ lineaId: existing?.id ?? null, descripcion: existing?.descripcion ?? "Exceso de estadía al salir", antesCentimos: before, despuesCentimos: amount });
        }
      }
      const totalDespuesCentimos = active.reduce((sum, l) => sum + l.subtotalCentimos, 0) + cambios.reduce((sum, c) => sum + c.despuesCentimos - c.antesCentimos, 0);
      const devolverCentimos = Math.max(0, sale.pagadoCentimos - totalDespuesCentimos);
      const history = await this.getSaleHistory(sale.id);
      const available = new Map<PaymentMethod, number>();
      const order: PaymentMethod[] = [];
      for (const payment of history.pagos.filter((p) => p.estado === "ACEPTADO").reverse()) for (const d of payment.detalles) {
        available.set(d.metodo, (available.get(d.metodo) ?? 0) + d.montoCentimos);
        if (!order.includes(d.metodo)) order.push(d.metodo);
      }
      for (const m of history.movimientos) if (m.tipo === "DEVOLUCION" && m.metodo) available.set(m.metodo, (available.get(m.metodo) ?? 0) - m.montoCentimos);
      let remaining = devolverCentimos;
      const devoluciones: CheckoutPreview["devoluciones"] = [];
      for (const metodo of order) {
        const amount = Math.min(Math.max(0, available.get(metodo) ?? 0), remaining);
        if (amount > 0) devoluciones.push({ metodo, montoCentimos: amount });
        remaining -= amount;
      }
      if (remaining > 0) throw new Error("Los pagos registrados no permiten conciliar la devolución. Revisa el historial.");
      const revision = createHash("sha256").update(JSON.stringify({ sale, lines, checkoutPrevisto: stay.checkoutPrevisto, salidaDeclaradaEn: stay.salidaDeclaradaEn, horaSalida: exitTime.toISOString(), anularHorasExtra })).digest("hex");
      return { estadiaId: stay.id, ventaId: sale.id, horaSalida: exitTime.toISOString(), revision, anularHorasExtra, requiereConfirmacion: devolverCentimos > 0 || cambios.some((c) => c.despuesCentimos < c.antesCentimos), totalAntesCentimos: sale.totalCentimos, totalDespuesCentimos, saldoAntesCentimos: sale.saldoCentimos, saldoDespuesCentimos: Math.max(0, totalDespuesCentimos - sale.pagadoCentimos), devolverCentimos, devoluciones, cambios };
    });
  }

  async confirmCheckOut(stayId: string, usuarioId: string, input: CheckoutConfirmation): Promise<CheckoutResult> {
    return atomic(this.db, async () => {
      const preview = await this.previewCheckOut(stayId, input.horaSalida, input.anularHorasExtra);
      if (preview.revision !== input.revision) throw new Error("La cuenta cambió mientras revisabas. Actualiza la revisión antes de confirmar.");
      const motivo = input.motivo?.trim();
      if (preview.requiereConfirmacion && !motivo) throw new Error("Indica el motivo de la corrección de horas extra.");
      if (preview.devolverCentimos > 0 && input.confirmarDevolucion !== true) throw new Error("Confirma la devolución de las horas ya cobradas antes de continuar.");
      const before = await this.loadSaleDetails(preview.ventaId);
      await this.stays.declareExit(stayId, preview.horaSalida, motivo || "Salida registrada desde recepción", usuarioId);
      if (input.anularHorasExtra) {
        for (const line of before.lineas.filter((l) => !l.anulada && isHourLine(l))) await this.cancelLine(before.id, line.id, motivo || "Corrección de la hora real de salida", usuarioId);
      } else {
        await this.syncOverstayCharge(stayId, new Date(preview.horaSalida), usuarioId);
      }
      if (preview.devolverCentimos > 0) {
        await this.bus.publish("sale.refunded", { saleId: before.id, usuarioId, motivo: motivo || "Corrección de salida", devoluciones: preview.devoluciones });
        await this.repo.updateSale(before.id, { pagadoCentimos: before.pagadoCentimos - preview.devolverCentimos, saldoCentimos: 0, estado: "PAGADA" });
      }
      const updated = await this.loadSaleDetails(before.id);
      await recordAudit(this.db, { entidad: "sales_ventas", entidadId: before.id, accion: preview.requiereConfirmacion ? "CORREGIR_SALIDA" : "REGISTRAR_SALIDA", usuarioId, antes: before, despues: { ...updated, horaSalida: preview.horaSalida, anularHorasExtra: input.anularHorasExtra, cambios: preview.cambios, devoluciones: preview.devoluciones }, motivo: motivo || "Salida registrada desde recepción" });
      if (preview.requiereConfirmacion) await this.bus.publish("sale.checkout_corrected", { saleId: before.id, usuarioId, motivo: motivo! });
      if (updated.saldoCentimos === 0) {
        // Un intento de cobro de las horas anuladas deja de ser cobrable.
        // Se conserva como rechazado, con motivo y actor, antes de cerrar.
        const pendingPayments = await this.db.select().from(schema.paymentsPagos).where(and(eq(schema.paymentsPagos.ventaId, before.id), eq(schema.paymentsPagos.estado, "PENDIENTE"))).all();
        for (const payment of pendingPayments) {
          const rejectionReason = "Saldo resuelto en revisión de salida: " + (motivo || "Sin saldo pendiente");
          await this.db.update(schema.paymentsPagos).set({ estado: "RECHAZADO", motivoRechazo: rejectionReason }).where(eq(schema.paymentsPagos.id, payment.id));
          await recordAudit(this.db, { entidad: "payments_pagos", entidadId: payment.id, accion: "RECHAZAR_POR_CORRECCION_SALIDA", usuarioId, antes: payment, despues: { ...payment, estado: "RECHAZADO", motivoRechazo: rejectionReason }, motivo: rejectionReason });
          await this.bus.publish("payment.rejected", { paymentId: payment.id, saleId: before.id, usuarioId, motivo: rejectionReason });
        }
        await this.checkOutStay(stayId, usuarioId);
      }
      return { finalizada: updated.saldoCentimos === 0, estadia: await this.stays.getStay(stayId), venta: await this.loadSaleDetails(before.id) };
    });
  }

  async syncOverstayCharge(stayId: string, atTime?: Date, usuarioId?: string): Promise<SaleWithLines | null> {
    return atomic(this.db, async () => {
      const stay = await this.stays.getStay(stayId);
      const sale = await this.repo.getSaleByStay(stayId);
      if (!sale) return null;
      if (["CERRADA", "ANULADA"].includes(sale.estado) || ["FINALIZADA", "ANULADA", "RESERVADA"].includes(stay.estado)) return this.loadSaleDetails(sale.id);
      const modality = await this.pricing.getModality(stay.modalidadId);
      const lines = await this.repo.listLines(sale.id, true);
      const automatic = lines.filter((l) => l.tipo === "CARGO_EXTRA" && l.referenciaId === "EXCESO_TIEMPO");
      const existing = automatic.find((l) => !l.anulada) ?? automatic.at(-1);
      if (automatic.some((l) => l.anulada && l.motivoAnulacion !== "Check-out dentro de tolerancia")) return this.loadSaleDetails(sale.id);
      const refTime = stay.salidaDeclaradaEn ? new Date(stay.salidaDeclaradaEn) : atTime ?? new Date();
      if (!Number.isFinite(refTime.getTime())) throw new Error("Hora de cálculo inválida.");
      const deadline = Date.parse(stay.checkoutPrevisto) + stay.toleranciaMin * 60_000;
      const unitPrice = existing?.precioUnitarioCentimos ?? modality.precioAdicionalCentimos;
      const interval = existing?.intervaloMinutos ?? modality.tiempoAdicionalMinutos ?? 60;
      if (unitPrice <= 0 || interval <= 0) return this.loadSaleDetails(sale.id);
      if (refTime.getTime() <= deadline) {
        if (existing && !existing.anulada) {
          await this.repo.updateLine(existing.id, { anulada: true, motivoAnulacion: "Check-out dentro de tolerancia" });
          await this.recalcularTotales(sale.id);
          await recordAudit(this.db, { entidad: "sales_lineas", entidadId: existing.id, accion: "RECALCULAR_EXCESO", usuarioId, antes: existing, despues: { anulada: true }, motivo: "Check-out dentro de tolerancia" });
        }
        return this.loadSaleDetails(sale.id);
      }
      const blocks = Math.ceil((refTime.getTime() - deadline) / (interval * 60_000));
      const descripcion = "Exceso de estadía (" + blocks + " × " + interval + " min)";
      const patch = { cantidad: blocks, precioUnitarioCentimos: unitPrice, subtotalCentimos: blocks * unitPrice, descripcion, intervaloMinutos: interval, anulada: false, motivoAnulacion: null };
      if (existing) {
        if (existing.cantidad !== blocks || existing.anulada || existing.intervaloMinutos == null) {
          const updated = await this.repo.updateLine(existing.id, patch);
          await this.recalcularTotales(sale.id);
          await recordAudit(this.db, { entidad: "sales_lineas", entidadId: existing.id, accion: "RECALCULAR_EXCESO", usuarioId, antes: existing, despues: updated, motivo: "Cálculo automático hasta " + refTime.toISOString() });
        }
      } else {
        const line = await this.repo.insertLine({ id: newId(), ventaId: sale.id, tipo: "CARGO_EXTRA", referenciaId: "EXCESO_TIEMPO", ...patch, fase: sale.pagadaEn ? "POST_PAGO" : "PRE_PAGO", usuarioId: "system", creadoEn: new Date().toISOString() });
        await this.recalcularTotales(sale.id);
        await recordAudit(this.db, { entidad: "sales_lineas", entidadId: line.id, accion: "AGREGAR_EXCESO_AUTOMATICO", despues: line, motivo: "Cálculo automático hasta " + refTime.toISOString() });
        await afterCommit(this.db, () => this.bus.publish("sale.line_added", { saleId: sale.id, lineId: line.id, phase: line.fase }));
      }
      return this.loadSaleDetails(sale.id);
    });
  }

  async syncAllActiveOverstays(atTime?: Date): Promise<void> {
    try {
      const activeStays = await this.stays.listActiveStays();
      const exceeded = activeStays.filter((s) => s.estado === "EXCEDIDA");
      for (const stay of exceeded) {
        await this.syncOverstayCharge(stay.id, atTime);
      }
    } catch (err) {
      console.error("[sales] Error syncing active overstays:", err);
    }
  }

  async listOpenSales(): Promise<Sale[]> {
    return this.repo.listOpen();
  }

  async listSalesByRange(desde: string, hasta: string): Promise<Sale[]> {
    const sales = await this.repo.listByRange(desde, hasta);
    const rooms = await this.db.select().from(schema.roomsCuartos).all();
    const numbers = new Map(rooms.map((r) => [r.id, r.numero]));
    return sales.map((sale) => ({ ...sale, cuartoNumero: sale.cuartoId ? numbers.get(sale.cuartoId) ?? null : null }));
  }

  async listCancelledSales(desde?: string, hasta?: string): Promise<CancelledSale[]> {
    const sales = await this.repo.listCancelled(desde, hasta);
    if (sales.length === 0) return [];

    const saleIds = sales.map((s) => s.id);
    const auditRows = await this.db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.entidad, "sales_ventas"), eq(schema.auditLog.accion, "ANULAR"), inArray(schema.auditLog.entidadId, saleIds)))
      .all();

    const users = await this.db.select().from(schema.identityUsuarios).all();
    const userMap = new Map(users.map((u) => [u.id, `${u.nombres} ${u.apellidos}`.trim() || u.usuario]));

    const auditMap = new Map<string, typeof schema.auditLog.$inferSelect>();
    for (const a of auditRows) {
      const existing = auditMap.get(a.entidadId);
      if (!existing || existing.ocurridoEn < a.ocurridoEn) {
        auditMap.set(a.entidadId, a);
      }
    }

    const allLines = await this.db
      .select()
      .from(schema.salesLineas)
      .where(inArray(schema.salesLineas.ventaId, saleIds))
      .all();
    const linesBySaleId = new Map<string, SaleLine[]>();
    for (const l of allLines) {
      const list = linesBySaleId.get(l.ventaId) ?? [];
      list.push({
        id: l.id,
        ventaId: l.ventaId,
        tipo: l.tipo,
        referenciaId: l.referenciaId,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precioUnitarioCentimos: l.precioUnitarioCentimos,
        subtotalCentimos: l.subtotalCentimos,
        fase: l.fase,
        anulada: l.anulada,
        motivoAnulacion: l.motivoAnulacion,
        usuarioId: l.usuarioId,
        creadoEn: l.creadoEn,
      });
      linesBySaleId.set(l.ventaId, list);
    }

    return sales.map((sale) => {
      const audit = auditMap.get(sale.id);
      let parsedDespues: Record<string, unknown> | null = null;
      if (audit?.despuesJson) {
        try {
          parsedDespues = JSON.parse(audit.despuesJson);
        } catch {}
      }
      const anuladoPorId = audit?.usuarioId ?? (parsedDespues?.anuladoPor as string) ?? null;
      const correlationId = (parsedDespues?.correlationId as string) ?? null;
      const idempotencyKey = (parsedDespues?.idempotencyKey as string) ?? null;
      const anuladoEn = audit?.ocurridoEn ?? (parsedDespues?.anuladoEn as string) ?? null;
      const anuladoPorNombre = anuladoPorId ? userMap.get(anuladoPorId) ?? anuladoPorId : null;

      return {
        ...sale,
        motivoAnulacion: sale.motivoAnulacion || audit?.motivo || "Anulada",
        anuladoPorUsuarioId: anuladoPorId,
        anuladoPorNombre,
        anuladoEn,
        correlationId,
        idempotencyKey,
        lineas: linesBySaleId.get(sale.id) ?? [],
      };
    });
  }

  async cancelSale(
    saleIdOrInput: string | CancelSaleInput,
    motivoArg?: string,
    usuarioIdArg?: string,
    correlationIdArg?: string,
    idempotencyKeyArg?: string,
  ): Promise<Sale> {
    return atomic(this.db, async () => {
      const input: CancelSaleInput =
        typeof saleIdOrInput === "string"
          ? {
              saleId: saleIdOrInput,
              motivo: motivoArg ?? "Anulada por usuario",
              usuarioId: usuarioIdArg ?? "system",
              correlationId: correlationIdArg,
              idempotencyKey: idempotencyKeyArg,
            }
          : saleIdOrInput;

      const sale = await this.mustGet(input.saleId);

      // Idempotencia: si ya estaba anulada, retorna de inmediato sin duplicar acciones
      if (sale.estado === "ANULADA") {
        return sale;
      }

      const correlationId = input.correlationId || `corr_${newId()}`;
      const idempotencyKey = input.idempotencyKey || `idem_${newId()}`;
      const motivo = input.motivo?.trim();
      if (!motivo) throw new Error("Indica el motivo de la anulación.");
      const openShift = await this.db.select().from(schema.cashboxTurnos).innerJoin(schema.cashboxConfiguracion, eq(schema.cashboxConfiguracion.turnoActivoId, schema.cashboxTurnos.id)).where(and(eq(schema.cashboxConfiguracion.id, "principal"), eq(schema.cashboxTurnos.estado, "ABIERTO"))).get();
      if (sale.pagadoCentimos > 0 && !openShift) throw new Error("Abre la caja del hotel para registrar la anulación de una venta cobrada.");

      // 1. Devolver stock de productos de todas las líneas activas de la venta
      const lines = await this.repo.listLines(input.saleId);
      for (const line of lines) {
        if (!line.anulada && line.tipo === "PRODUCTO") {
          await this.inventory
            .returnStock({
              lineaVentaId: line.id,
              usuarioId: input.usuarioId,
              motivo: `Venta anulada (${correlationId}): ${motivo}`,
            });
          await this.repo.updateLine(line.id, { anulada: true, motivoAnulacion: motivo });
        }
      }

      // 2. Si tenía estadía activa vinculada, cancelarla para desocupar la habitación
      if (sale.estadiaId && (await this.stays.getStay(sale.estadiaId)).estado !== "FINALIZADA") {
        await this.stays
          .cancel(sale.estadiaId, `Venta anulada (${correlationId}): ${motivo}`, input.usuarioId);
      }

      // 3. Actualizar estado de la venta
      const updated = await this.repo.updateSale(input.saleId, {
        estado: "ANULADA",
        motivoAnulacion: motivo,
      });

      // 4. Registrar auditoría completa con correlationId e idempotencyKey
      await recordAudit(this.db, {
        entidad: "sales_ventas",
        entidadId: input.saleId,
        accion: "ANULAR",
        usuarioId: input.usuarioId,
        antes: sale,
        despues: {
          ...updated,
          correlationId,
          idempotencyKey,
          anuladoPor: input.usuarioId,
          anuladoEn: new Date().toISOString(),
        },
        motivo,
      });

      // 5. Publicar evento en el bus para que caja y comprobantes reaccionen
      await this.bus.publish("sale.cancelled", {
        saleId: input.saleId,
        motivo,
        usuarioId: input.usuarioId,
        correlationId,
        idempotencyKey,
      });

      return updated;
    });
  }

  /** Bus reaction, wired by index.ts — not part of `SalesPort`. A sale never accepts its own payment. */
  async handlePaymentAccepted(saleId: string, montoCentimos: number, usuarioId: string): Promise<void> {
    const sale = await this.mustGet(saleId);
    const pagadoCentimos = sale.pagadoCentimos + montoCentimos;
    const saldoCentimos = sale.totalCentimos - pagadoCentimos;
    const estado = saldoCentimos <= 0 ? "PAGADA" : "CON_SALDO";
    const now = new Date().toISOString();
    const updated = await this.repo.updateSale(saleId, { pagadoCentimos, saldoCentimos, estado, pagadaEn: sale.pagadaEn ?? now });
    await recordAudit(this.db, { entidad: "sales_ventas", entidadId: saleId, accion: "PAGO_ACEPTADO", usuarioId, antes: sale, despues: updated });
    if (saldoCentimos <= 0) {
      await afterCommit(this.db, () => this.bus.publish("sale.paid", { saleId, totalCentimos: updated.totalCentimos }));
    }
  }

  /** Bus reaction, wired by index.ts. */
  async handlePaymentRejected(saleId: string, usuarioId: string, motivo: string): Promise<void> {
    const sale = await this.repo.getSale(saleId);
    if (!sale || sale.estado !== "ABIERTA") return;
    if (sale.estadiaId && (await this.stays.getStay(sale.estadiaId)).salidaDeclaradaEn) return;
    await this.cancelSale({ saleId, usuarioId, motivo: "Pago rechazado: " + motivo });
  }

  /**
   * Un solo punto para agregar una línea a una venta: decide `fase` a partir
   * de si la venta ya está pagada — nunca del llamador — y mantiene
   * total/saldo consistentes. Ver REGLAS-DE-NEGOCIO.md §7.
   */
  private async appendLine(
    sale: Sale,
    input: {
      tipo: "CARGO_EXTRA" | "PRODUCTO";
      referenciaId: string;
      descripcion: string;
      cantidad: number;
      precioUnitarioCentimos: number;
      subtotalCentimos: number;
      usuarioId: string;
      auditAccion: string;
    },
  ): Promise<SaleLine> {
    this.assertEditable(sale);
    if (!Number.isSafeInteger(input.cantidad) || input.cantidad <= 0 || !Number.isSafeInteger(input.subtotalCentimos) || input.subtotalCentimos < 0) throw new Error("Cantidad o monto inválido.");
    const fase: LinePhase = sale.pagadaEn ? "POST_PAGO" : "PRE_PAGO";
    const now = new Date().toISOString();

    const line = await this.repo.insertLine({
      id: newId(),
      ventaId: sale.id,
      tipo: input.tipo,
      referenciaId: input.referenciaId,
      descripcion: input.descripcion,
      cantidad: input.cantidad,
      precioUnitarioCentimos: input.precioUnitarioCentimos,
      subtotalCentimos: input.subtotalCentimos,
      fase,
      anulada: false,
      motivoAnulacion: null,
      usuarioId: input.usuarioId,
      creadoEn: now,
    });

    await this.recalcularTotales(sale.id);

    await recordAudit(this.db, { entidad: "sales_lineas", entidadId: line.id, accion: input.auditAccion, usuarioId: input.usuarioId, despues: line });
    await this.bus.publish("sale.line_added", { saleId: sale.id, lineId: line.id, phase: fase });
    return line;
  }

  /**
   * Recalcula total y saldo SUMANDO las líneas vigentes, en vez de ir sumando
   * y restando sobre el total ya guardado.
   *
   * El total incremental se descuadraba de verdad, por dos caminos distintos
   * (los dos vistos en la base real):
   *
   * 1. **Anulación a medias**: `cancelLine` marcaba la línea anulada y recién
   *    después restaba del total; si algo fallaba en el medio (devolver el
   *    stock), la línea desaparecía de la vista pero el total la seguía
   *    cobrando. Así apareció una venta cobrando S/ 72 con una sola línea de
   *    S/ 60 a la vista.
   * 2. **Escrituras pisadas**: `appendLine` hacía `sale.totalCentimos + x`
   *    sobre una copia leída antes; con el kiosco y recepción agregando a la
   *    vez, la segunda escritura pisaba a la primera y esa línea quedaba sin
   *    cobrar.
   *
   * Derivándolo de las líneas, el total no puede quedar desalineado con lo
   * que el comprobante muestra: es la misma fuente. Y como se recalcula
   * entero cada vez, cualquier venta que ya venga descuadrada se corrige sola
   * la próxima vez que se le toque una línea.
   */
  private async recalcularTotales(saleId: string): Promise<void> {
    const sale = await this.mustGet(saleId);
    // listLines ya excluye las anuladas — misma fuente que usa el comprobante.
    const lineas = await this.repo.listLines(saleId);
    const totalCentimos = lineas.reduce((acc, l) => acc + l.subtotalCentimos, 0);
    const saldoCentimos = totalCentimos - sale.pagadoCentimos;
    const estado = ["CERRADA", "ANULADA"].includes(sale.estado) ? sale.estado : sale.pagadaEn ? (saldoCentimos > 0 ? "CON_SALDO" : "PAGADA") : sale.estado;
    await this.repo.updateSale(saleId, { totalCentimos, saldoCentimos, estado });
  }

  private assertEditable(sale: Sale): void {
    if (["CERRADA", "ANULADA"].includes(sale.estado)) throw new Error("La venta está cerrada o anulada. Consulta su historial o anula la venta completa con motivo.");
  }

  private async mustGet(id: string): Promise<Sale> {
    const sale = await this.repo.getSale(id);
    if (!sale) throw new Error(`Venta ${id} no encontrada.`);
    return sale;
  }
}

const isHourLine = (line: SaleLine) => line.tipo === "CARGO_EXTRA" && ["EXCESO_TIEMPO", "HORA_EXTRA_MANUAL"].includes(line.referenciaId ?? "");
