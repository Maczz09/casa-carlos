import { newId } from "@casacarlos/contracts";
import type { InventoryPort, PricingPort, RoomsPort, SalesPort, StaysPort } from "@casacarlos/contracts";
import type { EventBus } from "@casacarlos/bus";
import type { KioskCustomer, KioskSession, ProposedPaymentLine } from "./types.js";

type Listener = (session: KioskSession | null) => void;

export class KioskStore {
  private session: KioskSession | null = null;
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly rooms: RoomsPort,
    private readonly pricing: PricingPort,
    private readonly stays: StaysPort,
    private readonly sales: SalesPort,
    private readonly inventory: InventoryPort,
    bus: EventBus,
  ) {
    bus.subscribe("payment.accepted", (payload) => this.handlePaymentAccepted(payload.saleId, payload.paymentId));
    bus.subscribe("payment.rejected", (payload) => this.handlePaymentRejected(payload.saleId, payload.motivo));
  }

  getCurrent(): KioskSession | null {
    return this.session;
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(usuarioId: string, modalidadId: string, bloques: number, noches: number): Promise<KioskSession> {
    const modality = await this.pricing.getModality(modalidadId);
    const categories = await this.rooms.listCategories();
    const now = new Date();

    const preciosPorCategoria: Record<string, number> = {};
    for (const categoria of categories) {
      try {
        preciosPorCategoria[categoria.id] = modality.checkinFijo
          ? await this.pricing.resolveNightScalePrice({ modalidadId, categoriaId: categoria.id, noches })
          : (await this.pricing.resolveRate({ categoriaId: categoria.id, modalidadId, at: now })).precioCentimos * bloques;
      } catch {
        // sin tarifa configurada para esta categoría — se omite del preview, no bloquea el flujo
      }
    }

    const session: KioskSession = {
      id: newId(),
      estado: "SELECCION_PISO",
      actorActivo: "CLIENTE",
      modalidadId,
      bloques,
      noches,
      pisoId: null,
      cuartoId: null,
      preciosPorCategoria,
      cliente: null,
      stayId: null,
      saleId: null,
      totalCentimos: null,
      propuestaPago: null,
      paymentId: null,
      usuarioId,
      error: null,
      creadaEn: now.toISOString(),
      actualizadaEn: now.toISOString(),
    };
    return this.commit(session);
  }

  async selectFloor(pisoId: string): Promise<KioskSession> {
    const session = this.mustGet();
    return this.commit({ ...session, pisoId, estado: "SELECCION_CUARTO", error: null });
  }

  async selectRoom(cuartoId: string): Promise<KioskSession> {
    const session = this.mustGet();
    await this.rooms.assertAvailable(cuartoId);
    const updated = { ...session, cuartoId, error: null };
    return this.afterRoomOrCustomer(updated);
  }

  async setCustomer(cliente: KioskCustomer): Promise<KioskSession> {
    const session = this.mustGet();
    const updated = { ...session, cliente, error: null };
    return this.afterRoomOrCustomer(updated);
  }

  private async afterRoomOrCustomer(session: KioskSession): Promise<KioskSession> {
    if (!session.cuartoId) return this.commit({ ...session, estado: "SELECCION_CUARTO" });
    if (!session.cliente) return this.commit({ ...session, estado: "DATOS_CLIENTE" });
    if (session.stayId) return this.commit(session); // ya creada

    try {
      const stay = await this.stays.checkInWalkIn({
        cuartoId: session.cuartoId,
        modalidadId: session.modalidadId!,
        cliente: session.cliente,
        usuarioId: session.usuarioId,
        bloques: session.bloques,
        noches: session.noches,
      });
      const sale = await this.sales.openSaleForStay({ stayId: stay.id, usuarioId: session.usuarioId });
      return this.commit({
        ...session,
        estado: "SELECCION_PRODUCTOS",
        stayId: stay.id,
        saleId: sale.id,
        totalCentimos: sale.totalCentimos,
      });
    } catch (err) {
      return this.commit({ ...session, estado: "SELECCION_CUARTO", cuartoId: null, error: (err as Error).message });
    }
  }

  /** Opcional — el huésped puede agregar productos antes de pagar, o saltar directo con `finishProducts`. Refresca `totalCentimos` desde la venta real tras cada línea agregada. */
  async addProduct(productoId: string, cantidad: number): Promise<KioskSession> {
    const session = this.mustGet();
    if (!session.saleId) throw new Error("Todavía no hay una venta abierta.");
    await this.sales.addProductLine({ saleId: session.saleId, productoId, cantidad, usuarioId: session.usuarioId });
    const sale = await this.sales.getSale(session.saleId);
    return this.commit({ ...session, totalCentimos: sale.totalCentimos, error: null });
  }

  async finishProducts(): Promise<KioskSession> {
    const session = this.mustGet();
    return this.commit({ ...session, estado: "SELECCION_PAGO" });
  }

  async proposePayment(detalles: ProposedPaymentLine[]): Promise<KioskSession> {
    const session = this.mustGet();
    return this.commit({ ...session, propuestaPago: detalles, estado: "PAGO_PENDIENTE", error: null });
  }

  async takeControl(actor: "CLIENTE" | "RECEPCION"): Promise<KioskSession> {
    const session = this.mustGet();
    return this.commit({ ...session, actorActivo: actor });
  }

  /** Abandona la sesión en cualquier punto. Si ya había cuarto ocupado, lo libera. */
  async reset(motivo: string): Promise<void> {
    const session = this.session;
    if (session?.stayId && session.estado !== "ACEPTADO") {
      await this.stays.cancel(session.stayId, motivo, session.usuarioId).catch(() => {});
    }
    this.commit(null);
  }

  private handlePaymentAccepted(saleId: string, paymentId: string): void {
    if (this.session?.saleId !== saleId) return;
    this.commit({ ...this.session, estado: "ACEPTADO", paymentId, error: null });
  }

  private handlePaymentRejected(saleId: string, motivo: string): void {
    if (this.session?.saleId !== saleId) return;
    this.commit({ ...this.session, estado: "RECHAZADO", error: motivo });
  }

  private mustGet(): KioskSession {
    if (!this.session) throw new Error("No hay una sesión de kiosco activa.");
    return this.session;
  }

  private commit<T extends KioskSession | null>(session: T): T {
    this.session = session ? { ...session, actualizadaEn: new Date().toISOString() } : null;
    for (const listener of this.listeners) listener(this.session);
    return this.session as T;
  }
}
