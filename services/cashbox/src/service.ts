import type { Db } from "@casacarlos/db";
import { atomic, recordAudit } from "@casacarlos/db";
import { newId } from "@casacarlos/contracts";
import type {
  Arqueo,
  CashboxAutomation,
  CashboxPort,
  CashMovement,
  CashSummary,
  CashMovementFilter,
  CloseShiftInput,
  CreateShiftTemplateInput,
  DateRange,
  ManualMovementInput,
  OpenShiftInput,
  PaymentMethod,
  PaymentsPort,
  RegistrarArqueoInput,
  Shift,
  ShiftTemplate,
  UpdateShiftTemplateInput,
} from "@casacarlos/contracts";
import { cents, format, splitIncludedIgv } from "@casacarlos/money";
import type { EventBus } from "@casacarlos/bus";
import { CashboxRepo } from "./repo.js";
import { sumDenominaciones } from "./domain/denominaciones.js";
import { DIFFERENCE_THRESHOLD_CENTIMOS, expectedCash } from "./domain/expected-cash.js";
import { scheduledPeriod, scheduleProblem, validTime } from "./domain/shift-schedule.js";

export class CashboxService implements CashboxPort {
  private readonly repo: CashboxRepo;

  constructor(
    private readonly db: Db,
    private readonly bus: EventBus,
    private readonly payments: PaymentsPort,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.repo = new CashboxRepo(db);
    bus.subscribe("payment.accepted", (payload) => this.recordSalePayment(payload.paymentId, payload.saleId, payload.aceptadoPor), { critical: true });
    bus.subscribe("sale.checkout_corrected", async (payload) => {
      const shift = await this.getOpenShift();
      if (!shift) return;
      await this.repo.insertMovement({ id: newId(), turnoId: shift.id, tipo: "CORRECCION", metodo: null, montoCentimos: 0, ventaId: payload.saleId, pagoId: null, vueltoCentimos: null, motivo: payload.motivo, usuarioId: payload.usuarioId, ocurridoEn: new Date().toISOString() });
    }, { critical: true });
    bus.subscribe("sale.refunded", async (payload) => {
      const shift = await this.getOpenShift();
      if (!shift) throw new Error("Abre tu caja para registrar la devolución por corrección de salida.");
      for (const item of payload.devoluciones) {
        const movement = await this.repo.insertMovement({ id: newId(), turnoId: shift.id, tipo: "DEVOLUCION", metodo: item.metodo, montoCentimos: item.montoCentimos, ventaId: payload.saleId, pagoId: null, vueltoCentimos: null, motivo: payload.motivo, usuarioId: payload.usuarioId, ocurridoEn: new Date().toISOString() });
        await recordAudit(this.db, { entidad: "cashbox_movimientos", entidadId: movement.id, accion: "DEVOLVER_POR_CORRECCION_SALIDA", usuarioId: payload.usuarioId, despues: movement, motivo: payload.motivo });
      }
    }, { critical: true });
    bus.subscribe("sale.cancelled", (payload) =>
      this.handleSaleCancelled(payload.saleId, payload.motivo, payload.usuarioId, payload.correlationId),
      { critical: true },
    );
  }

  async createShiftTemplate(input: CreateShiftTemplateInput, usuarioId = "system"): Promise<ShiftTemplate> {
    return atomic(this.db, async () => {
    if (!validTime(input.horaInicio) || !validTime(input.horaFin) || input.horaInicio === input.horaFin) {
      throw new Error("El formato de las horas debe ser HH:mm (ej. 09:00, 17:00).");
    }
    const created = await this.repo.insertTemplate({
      id: newId(),
      nombre: input.nombre.trim(),
      horaInicio: input.horaInicio,
      horaFin: input.horaFin,
      orden: input.orden ?? 0,
      activa: true,
    });
    await recordAudit(this.db, { entidad: "cashbox_plantillas_turno", entidadId: created.id, accion: "CREAR_HORARIO", usuarioId, despues: created });
    await this.bus.publish("cashbox.changed", { turnoId: null });
    return created;
    });
  }

  async updateShiftTemplate(id: string, input: UpdateShiftTemplateInput, usuarioId = "system"): Promise<ShiftTemplate> {
    return atomic(this.db, async () => {
    const existing = await this.repo.getTemplate(id);
    if (!existing) throw new Error(`Plantilla de turno con id ${id} no encontrada.`);

    if (input.horaInicio && !validTime(input.horaInicio)) {
      throw new Error("El formato de hora de inicio debe ser HH:mm (ej. 09:00).");
    }
    if (input.horaFin && !validTime(input.horaFin)) {
      throw new Error("El formato de hora de fin debe ser HH:mm (ej. 17:00).");
    }

    const patch: {
      nombre?: string;
      horaInicio?: string;
      horaFin?: string;
      orden?: number;
      activa?: boolean;
    } = {};

    if (input.nombre !== undefined) patch.nombre = input.nombre.trim();
    if (input.horaInicio !== undefined) patch.horaInicio = input.horaInicio;
    if (input.horaFin !== undefined) patch.horaFin = input.horaFin;
    if (input.orden !== undefined) patch.orden = input.orden;
    if (input.activa !== undefined) patch.activa = input.activa;

    if ((patch.horaInicio ?? existing.horaInicio) === (patch.horaFin ?? existing.horaFin)) throw new Error("Las horas de inicio y fin deben ser distintas.");
    const updated = await this.repo.updateTemplate(id, patch);
    await recordAudit(this.db, { entidad: "cashbox_plantillas_turno", entidadId: id, accion: "EDITAR_HORARIO", usuarioId, antes: existing, despues: updated });
    await this.bus.publish("cashbox.changed", { turnoId: null });
    return updated;
    });
  }

  async deleteShiftTemplate(id: string, usuarioId = "system"): Promise<void> {
    return atomic(this.db, async () => {
    const existing = await this.repo.getTemplate(id);
    if (!existing) throw new Error(`Plantilla de turno con id ${id} no encontrada.`);
    await this.repo.deleteTemplate(id);
    await recordAudit(this.db, { entidad: "cashbox_plantillas_turno", entidadId: id, accion: "DESACTIVAR_HORARIO", usuarioId, antes: existing });
    await this.bus.publish("cashbox.changed", { turnoId: null });
    });
  }

  async listShiftTemplates(): Promise<ShiftTemplate[]> {
    return this.repo.listTemplates();
  }

  async getShiftTemplate(id: string): Promise<ShiftTemplate | null> { return this.repo.getTemplate(id); }

  async applyStandardSchedule(usuarioId: string): Promise<ShiftTemplate[]> {
    return atomic(this.db, async () => {
      const antes = await this.repo.listTemplates();
      await this.repo.deactivateTemplates();
      for (const [nombre, horaInicio, horaFin, orden] of [["Turno Mañana", "09:00", "17:00", 1], ["Turno Tarde", "17:00", "01:00", 2], ["Turno Noche", "01:00", "09:00", 3]] as const) {
        await this.createShiftTemplate({ nombre, horaInicio, horaFin, orden }, usuarioId);
      }
      await this.setAutomation(true, usuarioId);
      const despues = await this.repo.listTemplates();
      await recordAudit(this.db, { entidad: "cashbox_configuracion", entidadId: "principal", accion: "APLICAR_HORARIOS_CONTINUOS", usuarioId, antes, despues, motivo: "Horarios anteriores conservados para consultas históricas." });
      return despues;
    });
  }

  async openShift(input: OpenShiftInput): Promise<Shift> {
    return atomic(this.db, async () => {
      if (!Number.isSafeInteger(input.aperturaCentimos) || input.aperturaCentimos < 0) throw new Error("Monto de apertura inválido.");
      await this.runTimers();
      const existing = await this.repo.findOpenShift();
      if (existing) throw new Error("La caja del hotel ya está abierta. Actualiza la pantalla para usar el mismo turno.");

      const now = this.clock();
      const templates = await this.repo.listTemplates();
      const automatico = (await this.repo.getConfig())?.automatico && !scheduleProblem(templates);
      const period = automatico ? scheduledPeriod(templates, now) : null;
      if (input.plantillaId && !templates.some(t => t.id === input.plantillaId)) throw new Error("El horario seleccionado ya no está disponible.");
      const shift = await this.repo.insertShift({
        id: newId(),
        plantillaId: period?.template.id ?? input.plantillaId ?? null,
        programadoHasta: period?.end.toISOString() ?? null,
        tipoCierre: null,
        turnoAnteriorId: null,
        usuarioId: input.usuarioId,
        fecha: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(now),
        abiertoEn: now.toISOString(),
        cerradoEn: null,
        aperturaCentimos: input.aperturaCentimos,
        efectivoEsperadoCentimos: null,
        efectivoDeclaradoCentimos: null,
        denominacionesCierreJson: null,
        diferenciaCentimos: null,
        justificacion: null,
        estado: "ABIERTO",
      });
      await this.repo.setActiveShift(shift.id);

      await this.repo.insertMovement({
        id: newId(),
        turnoId: shift.id,
        tipo: "APERTURA",
        metodo: null,
        montoCentimos: input.aperturaCentimos,
        ventaId: null,
        pagoId: null,
        vueltoCentimos: null,
        motivo: null,
        usuarioId: input.usuarioId,
        ocurridoEn: now.toISOString(),
      });

      await recordAudit(this.db, { entidad: "cashbox_turnos", entidadId: shift.id, accion: "ABRIR", usuarioId: input.usuarioId, despues: shift });
      await this.bus.publish("shift.opened", { turnoId: shift.id, usuarioId: input.usuarioId });
      return shift;
    });
  }

  async closeShift(input: CloseShiftInput): Promise<Shift> {
    return atomic(this.db, async () => {
      await this.runTimers();
      const shift = await this.getShift(input.turnoId);
      if (shift.estado !== "ABIERTO") throw new Error("Ese turno ya está cerrado.");
      if ((await this.repo.getConfig())?.turnoActivoId !== shift.id && !input.justificacion?.trim()) throw new Error("Explica el sustento de la conciliación del turno anterior.");

      const declarado = sumDenominaciones(input.denominaciones);
      const movements = await this.repo.listMovementsForShift(shift.id);
      const esperado = expectedCash(movements);
      const diferencia = declarado - esperado;

      if (Math.abs(diferencia) > DIFFERENCE_THRESHOLD_CENTIMOS && !input.justificacion) {
        throw new Error(
          `La diferencia (${format(cents(diferencia))}) supera el margen permitido de ${format(cents(DIFFERENCE_THRESHOLD_CENTIMOS))}. Escribe una justificación para poder cerrar.`,
        );
      }

      const now = new Date().toISOString();
      const updated = await this.repo.updateShift(shift.id, {
        cerradoEn: now,
        efectivoEsperadoCentimos: esperado,
        efectivoDeclaradoCentimos: declarado,
        denominacionesCierreJson: JSON.stringify(input.denominaciones),
        diferenciaCentimos: diferencia,
        justificacion: input.justificacion ?? null,
        estado: "CERRADO",
        tipoCierre: "MANUAL",
      });
      if ((await this.repo.getConfig())?.turnoActivoId === shift.id) await this.repo.setActiveShift(null);

      await this.repo.insertMovement({
        id: newId(),
        turnoId: shift.id,
        tipo: "CIERRE",
        metodo: null,
        montoCentimos: declarado,
        ventaId: null,
        pagoId: null,
        vueltoCentimos: null,
        motivo: input.justificacion ?? null,
        usuarioId: input.usuarioId,
        ocurridoEn: now,
      });

      await recordAudit(this.db, { entidad: "cashbox_turnos", entidadId: shift.id, accion: "CERRAR", usuarioId: input.usuarioId, antes: shift, despues: updated });
      await this.bus.publish("shift.closed", { turnoId: shift.id, usuarioId: input.usuarioId, diferenciaCentimos: diferencia });
      return updated;
    });
  }

  async getOpenShiftForUser(usuarioId: string): Promise<Shift | null> {
    return this.getOpenShift();
  }

  async getOpenShift(): Promise<Shift | null> {
    await this.runTimers();
    return this.repo.findOpenShift();
  }

  async getLegacyOpenShifts(): Promise<Shift[]> {
    const active = await this.repo.findOpenShift();
    return (await this.repo.listShifts()).filter(s => s.estado === "ABIERTO" && s.id !== active?.id);
  }

  async getAutomation(): Promise<CashboxAutomation> {
    const templates = await this.repo.listTemplates();
    const problema = scheduleProblem(templates);
    const shift = await this.repo.findOpenShift();
    return { habilitado: (await this.repo.getConfig())?.automatico ?? true, zonaHoraria: "America/Lima", horarioValido: !problema, problema, proximoCambio: shift?.programadoHasta ?? null };
  }

  async setAutomation(habilitado: boolean, usuarioId: string): Promise<CashboxAutomation> {
    return atomic(this.db, async () => {
      const antes = await this.getAutomation();
      if (habilitado && antes.problema) throw new Error(antes.problema);
      await this.repo.setAutomation(habilitado);
      const shift = await this.repo.findOpenShift();
      if (shift) {
        const period = habilitado ? scheduledPeriod(await this.repo.listTemplates(), this.clock()) : null;
        await this.repo.updateShift(shift.id, { plantillaId: period?.template.id ?? shift.plantillaId, programadoHasta: period?.end.toISOString() ?? null });
      }
      const despues = await this.getAutomation();
      await recordAudit(this.db, { entidad: "cashbox_configuracion", entidadId: "principal", accion: "CAMBIAR_RELEVOS_AUTOMATICOS", usuarioId, antes, despues });
      await this.bus.publish("cashbox.changed", { turnoId: shift?.id ?? null });
      return despues;
    });
  }

  async runTimers(now: Date = this.clock()): Promise<void> {
    await atomic(this.db, async () => {
      if (!(await this.repo.getConfig())?.automatico) return;
      const templates = await this.repo.listTemplates();
      if (scheduleProblem(templates)) return;
      let shift = await this.repo.findOpenShift();
      if (!shift) return; // La primera apertura siempre declara el fondo físico.
      if (!shift.programadoHasta) {
        const period = scheduledPeriod(templates, now);
        const programado = await this.repo.updateShift(shift.id, { plantillaId: period.template.id, programadoHasta: period.end.toISOString() });
        await recordAudit(this.db, { entidad: "cashbox_turnos", entidadId: shift.id, accion: "PROGRAMAR_RELEVO", usuarioId: "system", antes: shift, despues: programado, motivo: "Caja compartida vinculada al horario actual. Sin modificar cobros ni arqueos anteriores." });
        await this.bus.publish("cashbox.changed", { turnoId: shift.id });
        return;
      }
      // Recupera también límites atravesados durante un reinicio, sin crear
      // aperturas paralelas ni añadir los fondos heredados a las ventas.
      while (new Date(shift.programadoHasta!).getTime() <= now.getTime()) {
        const boundary = new Date(shift.programadoHasta!);
        const period = scheduledPeriod(templates, boundary);
        const esperado = expectedCash(await this.repo.listMovementsForShift(shift.id));
        const motivo = `Relevo automático por horario (${period.template.nombre}). Fondo trasladado sin arqueo físico.`;
        await this.repo.updateShift(shift.id, { estado: "CERRADO", tipoCierre: "AUTOMATICO", cerradoEn: boundary.toISOString(), efectivoEsperadoCentimos: esperado, justificacion: motivo });
        await this.repo.insertMovement({ id: newId(), turnoId: shift.id, tipo: "TRASPASO_SALIDA", metodo: "EFECTIVO", montoCentimos: esperado, ventaId: null, pagoId: null, vueltoCentimos: null, motivo, usuarioId: "system", ocurridoEn: boundary.toISOString() });
        const next = await this.repo.insertShift({ id: newId(), plantillaId: period.template.id, programadoHasta: period.end.toISOString(), tipoCierre: null, turnoAnteriorId: shift.id, usuarioId: "system", fecha: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(boundary), abiertoEn: boundary.toISOString(), cerradoEn: null, aperturaCentimos: esperado, efectivoEsperadoCentimos: null, efectivoDeclaradoCentimos: null, denominacionesCierreJson: null, diferenciaCentimos: null, justificacion: null, estado: "ABIERTO" });
        await this.repo.insertMovement({ id: newId(), turnoId: next.id, tipo: "APERTURA", metodo: null, montoCentimos: esperado, ventaId: null, pagoId: null, vueltoCentimos: null, motivo: `Fondo recibido del turno ${shift.id}. ${motivo}`, usuarioId: "system", ocurridoEn: boundary.toISOString() });
        await this.repo.setActiveShift(next.id);
        await recordAudit(this.db, { entidad: "cashbox_turnos", entidadId: shift.id, accion: "RELEVO_AUTOMATICO", usuarioId: "system", antes: shift, despues: { turnoSiguienteId: next.id, efectivoTraspasadoCentimos: esperado, efectivoDeclaradoCentimos: null }, motivo });
        await recordAudit(this.db, { entidad: "cashbox_turnos", entidadId: next.id, accion: "ABRIR_POR_RELEVO", usuarioId: "system", despues: next, motivo });
        await this.bus.publish("cashbox.changed", { turnoId: next.id });
        shift = next;
      }
    });
  }

  async getShift(id: string): Promise<Shift> {
    const shift = await this.repo.getShift(id);
    if (!shift) throw new Error(`Turno ${id} no encontrado.`);
    return shift;
  }

  async listShifts(range?: DateRange): Promise<Shift[]> {
    return this.repo.listShifts(range);
  }

  async addManualMovement(input: ManualMovementInput): Promise<CashMovement> {
    return atomic(this.db, async () => {
      await this.runTimers();
      const shift = await this.getShift(input.turnoId);
      if (shift.estado !== "ABIERTO") throw new Error("No se pueden registrar movimientos en un turno cerrado.");
      if (shift.id !== (await this.repo.findOpenShift())?.id) throw new Error("Ese turno anterior no es la caja activa del hotel. Actualiza la pantalla.");

      const movement = await this.repo.insertMovement({
        id: newId(),
        turnoId: input.turnoId,
        tipo: input.tipo,
        metodo: null,
        montoCentimos: input.montoCentimos,
        ventaId: null,
        pagoId: null,
        vueltoCentimos: null,
        motivo: input.motivo,
        usuarioId: input.usuarioId,
        ocurridoEn: new Date().toISOString(),
      });
      await recordAudit(this.db, { entidad: "cashbox_movimientos", entidadId: movement.id, accion: input.tipo, usuarioId: input.usuarioId, despues: movement, motivo: input.motivo });
      await this.bus.publish("cashbox.changed", { turnoId: shift.id });
      return movement;
    });
  }

  async listMovements(turnoId: string): Promise<CashMovement[]> {
    return this.repo.listMovementsForShift(turnoId);
  }

  async listAllMovements(filter?: CashMovementFilter): Promise<CashMovement[]> {
    if (filter?.desde && filter?.hasta && filter.desde > filter.hasta) {
      throw new Error("La fecha y hora inicial no pueden ser posteriores a la final.");
    }
    return this.repo.listAllMovements(filter);
  }

  /** Conteo de caja a mitad de turno — no cierra nada, solo deja constancia de cómo está la caja en ese momento. */
  async registrarArqueo(input: RegistrarArqueoInput): Promise<Arqueo> {
    return atomic(this.db, async () => {
      await this.runTimers();
      const shift = await this.getShift(input.turnoId);
      if (shift.estado !== "ABIERTO") throw new Error("No se puede registrar un arqueo de un turno cerrado.");

      const movements = await this.repo.listMovementsForShift(shift.id);
      const esperado = expectedCash(movements);
      const total = sumDenominaciones(input.denominaciones);

      const arqueo = await this.repo.insertArqueo({
        id: newId(),
        turnoId: input.turnoId,
        denominacionesJson: JSON.stringify(input.denominaciones),
        totalCentimos: total,
        efectivoEsperadoCentimos: esperado,
        diferenciaCentimos: total - esperado,
        usuarioId: input.usuarioId,
        creadoEn: new Date().toISOString(),
      });
      await recordAudit(this.db, { entidad: "cashbox_arqueos", entidadId: arqueo.id, accion: "ARQUEO", usuarioId: input.usuarioId, despues: arqueo });
      await this.bus.publish("cashbox.changed", { turnoId: shift.id });
      return arqueo;
    });
  }

  async listArqueos(turnoId: string): Promise<Arqueo[]> {
    return this.repo.listArqueos(turnoId);
  }

  async getArqueo(id: string): Promise<Arqueo | null> {
    return this.repo.getArqueo(id);
  }

  async getShiftSummary(turnoId: string): Promise<CashSummary> {
    const shift = await this.getShift(turnoId);
    const movements = await this.repo.listMovementsForShift(turnoId);
    const summary = this.summarize(shift.aperturaCentimos, movements, shift.efectivoDeclaradoCentimos, shift.diferenciaCentimos);
    // Los cierres anteriores conservan el resultado de su arqueo original.
    return { ...summary, efectivoEsperadoCentimos: shift.efectivoEsperadoCentimos ?? summary.efectivoEsperadoCentimos };
  }

  async getRangeSummary(range: DateRange): Promise<CashSummary> {
    const shifts = await this.repo.listShifts(range);
    const movements = await this.repo.listMovementsForShifts(shifts.map((s) => s.id));
    const closed = shifts.filter((s) => s.estado === "CERRADO");
    const declarado = closed.length > 0 && closed.every(s => s.efectivoDeclaradoCentimos !== null) ? closed.reduce((sum, s) => sum + s.efectivoDeclaradoCentimos!, 0) : null;
    const apertura = shifts.reduce((sum, s) => sum + s.aperturaCentimos, 0);
    return this.summarize(apertura, movements, declarado, declarado !== null ? closed.reduce((sum, s) => sum + (s.diferenciaCentimos ?? 0), 0) : null);
  }

  private summarize(
    aperturaCentimos: number,
    movements: CashMovement[],
    efectivoDeclaradoCentimos: number | null,
    diferenciaCentimos: number | null,
  ): CashSummary {
    const porMetodoMap = new Map<PaymentMethod, { totalCentimos: number; cantidad: number }>();
    let ingresosManualesCentimos = 0;
    let egresosManualesCentimos = 0;
    let vueltosCentimos = 0;
    let ventasBrutasCentimos = 0;

    for (const m of movements) {
      if ((m.tipo === "VENTA" || m.tipo === "ANULACION" || m.tipo === "DEVOLUCION") && m.metodo) {
        const sign = m.tipo === "VENTA" ? 1 : -1;
        ventasBrutasCentimos += sign * m.montoCentimos;
        const entry = porMetodoMap.get(m.metodo) ?? { totalCentimos: 0, cantidad: 0 };
        entry.totalCentimos += sign * m.montoCentimos;
        entry.cantidad += m.tipo === "VENTA" ? 1 : 0;
        porMetodoMap.set(m.metodo, entry);
      }
      if (m.tipo === "INGRESO") ingresosManualesCentimos += m.montoCentimos;
      if (m.tipo === "EGRESO") egresosManualesCentimos += m.montoCentimos;
      if (m.tipo === "VUELTO") vueltosCentimos += m.montoCentimos;
    }

    const impuestos = splitIncludedIgv(cents(ventasBrutasCentimos));

    return {
      aperturaCentimos,
      efectivoEsperadoCentimos: expectedCash(movements),
      efectivoDeclaradoCentimos,
      diferenciaCentimos,
      porMetodo: [...porMetodoMap.entries()].map(([metodo, v]) => ({ metodo, ...v })),
      ingresosManualesCentimos,
      egresosManualesCentimos,
      vueltosCentimos,
      ventasBrutasCentimos,
      valorVentaCentimos: impuestos.valorVenta,
      igvCentimos: impuestos.igv,
    };
  }

  /** Reacción al bus, no forma parte de `CashboxPort`. */
  private async recordSalePayment(paymentId: string, saleId: string, aceptadoPor: string): Promise<void> {
    const shift = await this.getOpenShift();
    if (!shift) {
      throw new Error("El cobro no se puede registrar sin una caja abierta.");
    }

    if ((await this.repo.listMovementsForSale(saleId)).some((m) => m.pagoId === paymentId && m.tipo === "VENTA")) return;
    const payment = await this.payments.getPayment(paymentId);
    const now = new Date().toISOString();

    for (const detalle of payment.detalles) {
      await this.repo.insertMovement({
        id: newId(),
        turnoId: shift.id,
        tipo: "VENTA",
        metodo: detalle.metodo,
        montoCentimos: detalle.montoCentimos,
        ventaId: saleId,
        pagoId: paymentId,
        vueltoCentimos: detalle.vueltoCentimos,
        motivo: null,
        usuarioId: aceptadoPor,
        ocurridoEn: now,
      });

      if (detalle.metodo === "EFECTIVO" && detalle.vueltoCentimos && detalle.vueltoCentimos > 0) {
        await this.repo.insertMovement({
          id: newId(),
          turnoId: shift.id,
          tipo: "VUELTO",
          metodo: null,
          montoCentimos: detalle.vueltoCentimos,
          ventaId: saleId,
          pagoId: paymentId,
          vueltoCentimos: null,
          motivo: null,
          usuarioId: aceptadoPor,
          ocurridoEn: now,
        });
      }
    }
  }

  private async handleSaleCancelled(
    saleId: string,
    motivo: string,
    usuarioId: string,
    correlationId: string,
  ): Promise<void> {
    const movements = await this.repo.listMovementsForSale(saleId);
    if (movements.some((m) => m.tipo === "ANULACION")) return;
    const shift = await this.getOpenShift();
    if (!shift) {
      if (movements.some((m) => m.tipo === "VENTA")) throw new Error("Abre tu caja para registrar la anulación.");
      return;
    }
    const byMethod = new Map<PaymentMethod, number>();
    for (const m of movements) {
      if ((m.tipo === "VENTA" || m.tipo === "DEVOLUCION") && m.metodo) byMethod.set(m.metodo, (byMethod.get(m.metodo) ?? 0) + (m.tipo === "VENTA" ? m.montoCentimos : -m.montoCentimos));
    }
    const now = new Date().toISOString();
    const entries = byMethod.size ? [...byMethod.entries()] : [[null, 0] as const];
    for (const [metodo, montoCentimos] of entries) {
      const reversal = await this.repo.insertMovement({ id: newId(), turnoId: shift.id, tipo: "ANULACION", metodo, montoCentimos, ventaId: saleId, pagoId: null, vueltoCentimos: null, motivo, usuarioId, ocurridoEn: now });
      await recordAudit(this.db, { entidad: "cashbox_movimientos", entidadId: reversal.id, accion: "REVERTIR_VENTA_ANULADA", usuarioId, despues: { ...reversal, correlationId }, motivo });
    }
  }
}
