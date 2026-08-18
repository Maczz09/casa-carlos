import type { Db } from "@casacarlos/db";
import { recordAudit } from "@casacarlos/db";
import { newId } from "@casacarlos/contracts";
import type {
  CashboxPort,
  CashMovement,
  CashSummary,
  CloseShiftInput,
  CreateShiftTemplateInput,
  DateRange,
  ManualMovementInput,
  OpenShiftInput,
  PaymentMethod,
  PaymentsPort,
  Shift,
  ShiftTemplate,
} from "@casacarlos/contracts";
import { cents, format } from "@casacarlos/money";
import type { EventBus } from "@casacarlos/bus";
import { CashboxRepo } from "./repo.js";
import { DIFFERENCE_THRESHOLD_CENTIMOS, expectedCash } from "./domain/expected-cash.js";

export class CashboxService implements CashboxPort {
  private readonly repo: CashboxRepo;

  constructor(
    private readonly db: Db,
    private readonly bus: EventBus,
    private readonly payments: PaymentsPort,
  ) {
    this.repo = new CashboxRepo(db);
    bus.subscribe("payment.accepted", (payload) => this.recordSalePayment(payload.paymentId, payload.saleId, payload.aceptadoPor));
  }

  async createShiftTemplate(input: CreateShiftTemplateInput): Promise<ShiftTemplate> {
    return this.repo.insertTemplate({ id: newId(), nombre: input.nombre, horaInicio: input.horaInicio, horaFin: input.horaFin, orden: 0, activa: true });
  }

  async listShiftTemplates(): Promise<ShiftTemplate[]> {
    return this.repo.listTemplates();
  }

  async openShift(input: OpenShiftInput): Promise<Shift> {
    const existing = await this.repo.findOpenShiftForUser(input.usuarioId);
    if (existing) throw new Error("Ya tienes un turno abierto — ciérralo antes de abrir otro.");

    const now = new Date();
    const shift = await this.repo.insertShift({
      id: newId(),
      plantillaId: input.plantillaId ?? null,
      usuarioId: input.usuarioId,
      fecha: now.toISOString().slice(0, 10),
      abiertoEn: now.toISOString(),
      cerradoEn: null,
      aperturaCentimos: input.aperturaCentimos,
      efectivoEsperadoCentimos: null,
      efectivoDeclaradoCentimos: null,
      diferenciaCentimos: null,
      justificacion: null,
      estado: "ABIERTO",
    });

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
  }

  async closeShift(input: CloseShiftInput): Promise<Shift> {
    const shift = await this.getShift(input.turnoId);
    if (shift.estado !== "ABIERTO") throw new Error("Ese turno ya está cerrado.");

    const movements = await this.repo.listMovementsForShift(shift.id);
    const esperado = expectedCash(movements);
    const diferencia = input.efectivoDeclaradoCentimos - esperado;

    if (Math.abs(diferencia) > DIFFERENCE_THRESHOLD_CENTIMOS && !input.justificacion) {
      throw new Error(
        `La diferencia (${format(cents(diferencia))}) supera el margen permitido de ${format(cents(DIFFERENCE_THRESHOLD_CENTIMOS))}. Escribe una justificación para poder cerrar.`,
      );
    }

    const now = new Date().toISOString();
    const updated = await this.repo.updateShift(shift.id, {
      cerradoEn: now,
      efectivoEsperadoCentimos: esperado,
      efectivoDeclaradoCentimos: input.efectivoDeclaradoCentimos,
      diferenciaCentimos: diferencia,
      justificacion: input.justificacion ?? null,
      estado: "CERRADO",
    });

    await this.repo.insertMovement({
      id: newId(),
      turnoId: shift.id,
      tipo: "CIERRE",
      metodo: null,
      montoCentimos: input.efectivoDeclaradoCentimos,
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
  }

  async getOpenShiftForUser(usuarioId: string): Promise<Shift | null> {
    return this.repo.findOpenShiftForUser(usuarioId);
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
    const shift = await this.getShift(input.turnoId);
    if (shift.estado !== "ABIERTO") throw new Error("No se pueden registrar movimientos en un turno cerrado.");

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
    return movement;
  }

  async listMovements(turnoId: string): Promise<CashMovement[]> {
    return this.repo.listMovementsForShift(turnoId);
  }

  async getShiftSummary(turnoId: string): Promise<CashSummary> {
    const shift = await this.getShift(turnoId);
    const movements = await this.repo.listMovementsForShift(turnoId);
    return this.summarize(shift.aperturaCentimos, movements, shift.efectivoDeclaradoCentimos, shift.diferenciaCentimos);
  }

  async getRangeSummary(range: DateRange): Promise<CashSummary> {
    const shifts = await this.repo.listShifts(range);
    const movements = await this.repo.listMovementsForShifts(shifts.map((s) => s.id));
    const closed = shifts.filter((s) => s.estado === "CERRADO");
    const declarado = closed.length > 0 ? closed.reduce((sum, s) => sum + (s.efectivoDeclaradoCentimos ?? 0), 0) : null;
    const apertura = shifts.reduce((sum, s) => sum + s.aperturaCentimos, 0);
    return this.summarize(apertura, movements, declarado, declarado !== null ? declarado - expectedCash(movements) : null);
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

    for (const m of movements) {
      if (m.tipo === "VENTA" && m.metodo) {
        const entry = porMetodoMap.get(m.metodo) ?? { totalCentimos: 0, cantidad: 0 };
        entry.totalCentimos += m.montoCentimos;
        entry.cantidad += 1;
        porMetodoMap.set(m.metodo, entry);
      }
      if (m.tipo === "INGRESO") ingresosManualesCentimos += m.montoCentimos;
      if (m.tipo === "EGRESO") egresosManualesCentimos += m.montoCentimos;
      if (m.tipo === "VUELTO") vueltosCentimos += m.montoCentimos;
    }

    return {
      aperturaCentimos,
      efectivoEsperadoCentimos: expectedCash(movements),
      efectivoDeclaradoCentimos,
      diferenciaCentimos,
      porMetodo: [...porMetodoMap.entries()].map(([metodo, v]) => ({ metodo, ...v })),
      ingresosManualesCentimos,
      egresosManualesCentimos,
      vueltosCentimos,
    };
  }

  /** Reacción al bus, no forma parte de `CashboxPort`. */
  private async recordSalePayment(paymentId: string, saleId: string, aceptadoPor: string): Promise<void> {
    const shift = await this.repo.findOpenShiftForUser(aceptadoPor);
    if (!shift) {
      console.warn(`[cashbox] pago ${paymentId} aceptado por ${aceptadoPor} sin turno abierto — no se registró en caja.`);
      return;
    }

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
        vueltoCentimos: null,
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
}
