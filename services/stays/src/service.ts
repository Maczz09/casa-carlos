import type { Db } from "@casacarlos/db";
import { recordAudit } from "@casacarlos/db";
import { newId } from "@casacarlos/contracts";
import type {
  CheckInWalkInInput,
  CreateReservationInput,
  Customer,
  CustomerInput,
  PricingPort,
  RoomsPort,
  Stay,
  StaysPort,
  StayWithCustomer,
} from "@casacarlos/contracts";
import type { EventBus } from "@casacarlos/bus";
import { StaysRepo } from "./repo.js";
import { hoursWindow, nightWindow, toleranceDeadline, windowsOverlap, type StayWindow } from "./domain/timing.js";

export class StaysService implements StaysPort {
  private readonly repo: StaysRepo;

  constructor(
    private readonly db: Db,
    private readonly bus: EventBus,
    private readonly rooms: RoomsPort,
    private readonly pricing: PricingPort,
  ) {
    this.repo = new StaysRepo(db);
  }

  async findOrCreateCustomer(input: CustomerInput): Promise<Customer> {
    const existing = await this.repo.findCustomerByDni(input.dni);
    if (existing) return existing;
    return this.repo.insertCustomer({
      id: newId(),
      nombres: input.nombres,
      apellidos: input.apellidos,
      dni: input.dni,
      telefono: input.telefono ?? null,
      creadoEn: new Date().toISOString(),
    });
  }

  async createReservation(input: CreateReservationInput): Promise<Stay> {
    const modality = await this.pricing.getModality(input.modalidadId);
    const cliente = await this.findOrCreateCustomer(input.cliente);
    const referenceDate = new Date(input.reservadaPara);
    const window = this.resolveWindow(modality, referenceDate, input.noches ?? 1, 1);

    await this.assertNoOverlap(input.cuartoId, window);

    const stay = await this.repo.insertStay({
      id: newId(),
      cuartoId: input.cuartoId,
      clienteId: cliente.id,
      modalidadId: input.modalidadId,
      ventaId: null,
      tipo: "RESERVA",
      estado: "RESERVADA",
      bloqueoDesde: window.bloqueoDesde.toISOString(),
      bloqueoHasta: window.bloqueoHasta.toISOString(),
      checkinPrevisto: window.checkinPrevisto.toISOString(),
      checkinReal: null,
      checkoutPrevisto: window.checkoutPrevisto.toISOString(),
      checkoutReal: null,
      noches: input.noches ?? 0,
      toleranciaMin: modality.toleranciaMin,
      notificadoExcesoEn: null,
      motivoAnulacion: null,
      usuarioId: input.usuarioId,
      creadoEn: new Date().toISOString(),
    });

    await recordAudit(this.db, { entidad: "stays_estadias", entidadId: stay.id, accion: "RESERVAR", usuarioId: input.usuarioId, despues: stay });
    await this.bus.publish("stay.reserved", { stayId: stay.id, roomId: stay.cuartoId, from: stay.bloqueoDesde, to: stay.bloqueoHasta });
    return stay;
  }

  async checkInWalkIn(input: CheckInWalkInInput): Promise<Stay> {
    await this.rooms.assertAvailable(input.cuartoId);
    const modality = await this.pricing.getModality(input.modalidadId);
    const cliente = await this.findOrCreateCustomer(input.cliente);
    const now = new Date();
    const window = this.resolveWindow(modality, now, input.noches ?? 1, input.bloques ?? 1);

    await this.assertNoOverlap(input.cuartoId, window);

    const stay = await this.repo.insertStay({
      id: newId(),
      cuartoId: input.cuartoId,
      clienteId: cliente.id,
      modalidadId: input.modalidadId,
      ventaId: null,
      tipo: "DIRECTA",
      estado: "EN_CURSO",
      bloqueoDesde: window.bloqueoDesde.toISOString(),
      bloqueoHasta: window.bloqueoHasta.toISOString(),
      checkinPrevisto: window.checkinPrevisto.toISOString(),
      checkinReal: now.toISOString(),
      checkoutPrevisto: window.checkoutPrevisto.toISOString(),
      checkoutReal: null,
      noches: input.noches ?? 0,
      toleranciaMin: modality.toleranciaMin,
      notificadoExcesoEn: null,
      motivoAnulacion: null,
      usuarioId: input.usuarioId,
      creadoEn: now.toISOString(),
    });

    await recordAudit(this.db, { entidad: "stays_estadias", entidadId: stay.id, accion: "CHECK_IN", usuarioId: input.usuarioId, despues: stay });
    await this.bus.publish("stay.checked_in", { stayId: stay.id, roomId: stay.cuartoId, modalidadId: stay.modalidadId, at: now.toISOString() });
    return stay;
  }

  async checkInReservation(stayId: string, usuarioId: string): Promise<Stay> {
    const stay = await this.mustGet(stayId);
    if (stay.estado !== "RESERVADA") throw new Error(`La estadía ${stayId} no está en estado RESERVADA.`);
    const updated = await this.repo.updateStay(stayId, { estado: "EN_CURSO", checkinReal: new Date().toISOString() });
    await recordAudit(this.db, { entidad: "stays_estadias", entidadId: stayId, accion: "CHECK_IN_RESERVA", usuarioId, antes: stay, despues: updated });
    await this.bus.publish("stay.checked_in", { stayId, roomId: updated.cuartoId, modalidadId: updated.modalidadId, at: updated.checkinReal! });
    return updated;
  }

  async checkOut(stayId: string, usuarioId: string): Promise<Stay> {
    const stay = await this.mustGet(stayId);
    if (!["EN_CURSO", "EN_TOLERANCIA", "EXCEDIDA"].includes(stay.estado)) {
      throw new Error(`La estadía ${stayId} no puede hacer check-out desde el estado ${stay.estado}.`);
    }
    const now = new Date().toISOString();
    const updated = await this.repo.updateStay(stayId, { estado: "FINALIZADA", checkoutReal: now });
    await recordAudit(this.db, { entidad: "stays_estadias", entidadId: stayId, accion: "CHECK_OUT", usuarioId, antes: stay, despues: updated });
    await this.bus.publish("stay.checked_out", { stayId, roomId: updated.cuartoId, at: now });
    return updated;
  }

  async cancel(stayId: string, motivo: string, usuarioId: string): Promise<Stay> {
    const stay = await this.mustGet(stayId);
    const updated = await this.repo.updateStay(stayId, { estado: "ANULADA", motivoAnulacion: motivo });
    await recordAudit(this.db, { entidad: "stays_estadias", entidadId: stayId, accion: "ANULAR", usuarioId, antes: stay, despues: updated, motivo });
    await this.bus.publish("stay.cancelled", { stayId, roomId: updated.cuartoId, motivo });
    return updated;
  }

  async extendByBlock(stayId: string, blocks: number, usuarioId: string): Promise<Stay> {
    const stay = await this.mustGet(stayId);
    const modality = await this.pricing.getModality(stay.modalidadId);
    const extraMs = modality.duracionHoras * blocks * 60 * 60_000;
    const checkoutPrevisto = new Date(new Date(stay.checkoutPrevisto).getTime() + extraMs).toISOString();
    const updated = await this.repo.updateStay(stayId, {
      checkoutPrevisto,
      bloqueoHasta: checkoutPrevisto,
      estado: stay.estado === "EN_TOLERANCIA" || stay.estado === "EXCEDIDA" ? "EN_CURSO" : stay.estado,
    });
    await recordAudit(this.db, { entidad: "stays_estadias", entidadId: stayId, accion: "EXTENDER_BLOQUE", usuarioId, antes: stay, despues: updated });
    await this.nudgeBoard(updated.cuartoId);
    return updated;
  }

  async addNight(stayId: string, usuarioId: string): Promise<Stay> {
    const stay = await this.mustGet(stayId);
    const modality = await this.pricing.getModality(stay.modalidadId);
    const noches = stay.noches + 1;
    const window = nightWindow(modality, new Date(stay.checkinPrevisto), noches);
    const updated = await this.repo.updateStay(stayId, {
      noches,
      checkoutPrevisto: window.checkoutPrevisto.toISOString(),
      bloqueoHasta: window.bloqueoHasta.toISOString(),
      estado: stay.estado === "EN_TOLERANCIA" || stay.estado === "EXCEDIDA" ? "EN_CURSO" : stay.estado,
    });
    await recordAudit(this.db, { entidad: "stays_estadias", entidadId: stayId, accion: "AGREGAR_NOCHE", usuarioId, antes: stay, despues: updated });
    await this.nudgeBoard(updated.cuartoId);
    return updated;
  }

  async getStay(id: string): Promise<StayWithCustomer> {
    return this.repo.withCustomer(await this.mustGet(id));
  }

  async getActiveStay(roomId: string): Promise<StayWithCustomer | null> {
    const now = new Date();
    const blocking = await this.repo.listBlockingForRoom(roomId);
    const occupying = blocking.filter((s) => s.estado !== "RESERVADA");
    if (occupying.length > 0) return this.repo.withCustomer(occupying[0]!);

    const reserved = blocking.find(
      (s) => s.estado === "RESERVADA" && new Date(s.bloqueoDesde) <= now && now < new Date(s.bloqueoHasta),
    );
    return reserved ? this.repo.withCustomer(reserved) : null;
  }

  async listActiveStays(): Promise<StayWithCustomer[]> {
    const active = await this.repo.listActive();
    return Promise.all(active.map((s) => this.repo.withCustomer(s)));
  }

  async runTimers(now: Date): Promise<{ toleranceStarted: string[]; overstayed: string[] }> {
    const toleranceStarted: string[] = [];
    const overstayed: string[] = [];

    for (const stay of await this.repo.listEnCursoDue(now)) {
      await this.repo.updateStay(stay.id, { estado: "EN_TOLERANCIA" });
      toleranceStarted.push(stay.id);
      const deadline = toleranceDeadline(new Date(stay.checkoutPrevisto), stay.toleranciaMin).toISOString();
      await this.bus.publish("stay.tolerance_started", { stayId: stay.id, roomId: stay.cuartoId, deadline });
      await this.bus.publish("room.status_changed", { roomId: stay.cuartoId, from: "OCUPADO", to: "EN_TOLERANCIA" });
    }

    for (const stay of await this.repo.listEnTolerancia()) {
      const deadline = toleranceDeadline(new Date(stay.checkoutPrevisto), stay.toleranciaMin);
      if (now < deadline) continue;
      await this.repo.updateStay(stay.id, { estado: "EXCEDIDA" });
      overstayed.push(stay.id);
      const minutesOver = Math.round((now.getTime() - new Date(stay.checkoutPrevisto).getTime()) / 60_000);
      await this.bus.publish("stay.overstayed", { stayId: stay.id, roomId: stay.cuartoId, minutesOver });
      await this.bus.publish("room.status_changed", { roomId: stay.cuartoId, from: "EN_TOLERANCIA", to: "EXCEDIDO" });
    }

    return { toleranceStarted, overstayed };
  }

  private async mustGet(id: string): Promise<Stay> {
    const stay = await this.repo.getStay(id);
    if (!stay) throw new Error(`Estadía ${id} no encontrada.`);
    return stay;
  }

  private resolveWindow(
    modality: Awaited<ReturnType<PricingPort["getModality"]>>,
    referenceDate: Date,
    noches: number,
    bloques: number,
  ): StayWindow {
    return modality.checkinFijo ? nightWindow(modality, referenceDate, noches) : hoursWindow(modality, referenceDate, bloques);
  }

  private async assertNoOverlap(roomId: string, window: StayWindow): Promise<void> {
    const existing = await this.repo.listBlockingForRoom(roomId);
    const clash = existing.some((s) => windowsOverlap(window.bloqueoDesde, window.bloqueoHasta, new Date(s.bloqueoDesde), new Date(s.bloqueoHasta)));
    if (clash) {
      throw new Error("El cuarto ya tiene una reserva o estadía que se solapa con ese horario.");
    }
  }

  /** No dedicated event for "duration changed" — nudges the board to refresh via the existing status-changed channel. */
  private async nudgeBoard(roomId: string): Promise<void> {
    const status = await this.rooms.getRoomStatus(roomId);
    await this.bus.publish("room.status_changed", { roomId, from: status, to: status });
  }
}
