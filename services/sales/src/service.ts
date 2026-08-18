import type { Db } from "@casacarlos/db";
import { recordAudit } from "@casacarlos/db";
import { newId } from "@casacarlos/contracts";
import type {
  AddExtraChargeInput,
  AddProductLineInput,
  InventoryPort,
  LinePhase,
  OpenSaleForStayInput,
  PricingPort,
  Sale,
  SaleLine,
  SalesPort,
  SaleWithLines,
  RoomsPort,
  StaysPort,
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
  }

  async openSaleForStay(input: OpenSaleForStayInput): Promise<Sale> {
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
  }

  async addExtraCharge(input: AddExtraChargeInput): Promise<SaleLine> {
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
  }

  async addProductLine(input: AddProductLineInput): Promise<SaleLine> {
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
  }

  async cancelLine(saleId: string, lineId: string, motivo: string, usuarioId: string): Promise<void> {
    const sale = await this.mustGet(saleId);
    const line = await this.repo.getLine(lineId);
    if (!line || line.ventaId !== saleId) throw new Error(`Línea ${lineId} no encontrada en la venta ${saleId}.`);
    if (line.anulada) throw new Error("Esa línea ya está anulada.");

    await this.repo.updateLine(lineId, { anulada: true, motivoAnulacion: motivo });

    if (line.tipo === "PRODUCTO") {
      await this.inventory.returnStock({ lineaVentaId: lineId, usuarioId, motivo });
    }

    const totalCentimos = sale.totalCentimos - line.subtotalCentimos;
    const saldoCentimos = totalCentimos - sale.pagadoCentimos;
    await this.repo.updateSale(saleId, { totalCentimos, saldoCentimos });

    await recordAudit(this.db, { entidad: "sales_lineas", entidadId: lineId, accion: "ANULAR_LINEA", usuarioId, antes: line, motivo });
  }

  async getSale(id: string): Promise<SaleWithLines> {
    const sale = await this.mustGet(id);
    return { ...sale, lineas: await this.repo.listLines(id) };
  }

  async getSaleForStay(stayId: string): Promise<SaleWithLines | null> {
    const sale = await this.repo.getSaleByStay(stayId);
    if (!sale) return null;
    return { ...sale, lineas: await this.repo.listLines(sale.id) };
  }

  async listOpenSales(): Promise<Sale[]> {
    return this.repo.listOpen();
  }

  async listSalesByRange(desde: string, hasta: string): Promise<Sale[]> {
    return this.repo.listByRange(desde, hasta);
  }

  async cancelSale(saleId: string, motivo: string, usuarioId: string): Promise<Sale> {
    const sale = await this.mustGet(saleId);
    const updated = await this.repo.updateSale(saleId, { estado: "ANULADA", motivoAnulacion: motivo });
    await recordAudit(this.db, { entidad: "sales_ventas", entidadId: saleId, accion: "ANULAR", usuarioId, antes: sale, despues: updated, motivo });
    return updated;
  }

  /** Bus reaction, wired by index.ts — not part of `SalesPort`. A sale never accepts its own payment. */
  async handlePaymentAccepted(saleId: string, montoCentimos: number): Promise<void> {
    const sale = await this.mustGet(saleId);
    const pagadoCentimos = sale.pagadoCentimos + montoCentimos;
    const saldoCentimos = sale.totalCentimos - pagadoCentimos;
    const estado = saldoCentimos <= 0 ? "PAGADA" : "CON_SALDO";
    const now = new Date().toISOString();
    const updated = await this.repo.updateSale(saleId, { pagadoCentimos, saldoCentimos, estado, pagadaEn: sale.pagadaEn ?? now });
    await recordAudit(this.db, { entidad: "sales_ventas", entidadId: saleId, accion: "PAGO_ACEPTADO", antes: sale, despues: updated });
    if (saldoCentimos <= 0) {
      await this.bus.publish("sale.paid", { saleId, totalCentimos: updated.totalCentimos });
    }
  }

  /** Bus reaction, wired by index.ts. */
  async handlePaymentRejected(saleId: string): Promise<void> {
    const sale = await this.repo.getSale(saleId);
    if (!sale || sale.estado !== "ABIERTA") return;
    await this.repo.updateSale(saleId, { estado: "ANULADA", motivoAnulacion: "Pago rechazado por recepción" });
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

    const totalCentimos = sale.totalCentimos + input.subtotalCentimos;
    const saldoCentimos = totalCentimos - sale.pagadoCentimos;
    const estado = saldoCentimos > 0 && (sale.estado === "PAGADA" || sale.estado === "CERRADA") ? "CON_SALDO" : sale.estado;
    await this.repo.updateSale(sale.id, { totalCentimos, saldoCentimos, estado });

    await recordAudit(this.db, { entidad: "sales_lineas", entidadId: line.id, accion: input.auditAccion, usuarioId: input.usuarioId, despues: line });
    await this.bus.publish("sale.line_added", { saleId: sale.id, lineId: line.id, phase: fase });
    return line;
  }

  private async mustGet(id: string): Promise<Sale> {
    const sale = await this.repo.getSale(id);
    if (!sale) throw new Error(`Venta ${id} no encontrada.`);
    return sale;
  }
}
