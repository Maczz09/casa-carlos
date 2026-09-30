import type { Db } from "@casacarlos/db";
import { recordAudit, schema } from "@casacarlos/db";
import { and, eq, inArray } from "drizzle-orm";
import { newId } from "@casacarlos/contracts";
import type {
  AddExtraChargeInput,
  AddProductLineInput,
  CancelledSale,
  CancelSaleInput,
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

    // Se recalcula ANTES de tocar el stock: si devolver el stock falla, la
    // plata ya quedó bien y el error se ve; al revés, la venta se quedaba
    // cobrando una línea que ya no existe (ver recalcularTotales).
    await this.recalcularTotales(saleId);

    if (line.tipo === "PRODUCTO") {
      await this.inventory.returnStock({ lineaVentaId: lineId, usuarioId, motivo });
    }

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
    const motivo = input.motivo || "Anulación de venta";

    // 1. Devolver stock de productos de todas las líneas activas de la venta
    const lines = await this.repo.listLines(input.saleId);
    for (const line of lines) {
      if (!line.anulada && line.tipo === "PRODUCTO") {
        await this.inventory
          .returnStock({
            lineaVentaId: line.id,
            usuarioId: input.usuarioId,
            motivo: `Venta anulada (${correlationId}): ${motivo}`,
          })
          .catch((err) => console.warn(`[sales] error al devolver stock para línea ${line.id}:`, err));
        await this.repo.updateLine(line.id, { anulada: true, motivoAnulacion: motivo }).catch(() => {});
      }
    }

    // 2. Si tenía estadía activa vinculada, cancelarla para desocupar la habitación
    if (sale.estadiaId) {
      await this.stays
        .cancel(sale.estadiaId, `Venta anulada (${correlationId}): ${motivo}`, input.usuarioId)
        .catch((err) => console.warn(`[sales] no se pudo cancelar estadía ${sale.estadiaId}:`, err));
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
    const estado = saldoCentimos > 0 && (sale.estado === "PAGADA" || sale.estado === "CERRADA") ? "CON_SALDO" : sale.estado;
    await this.repo.updateSale(saleId, { totalCentimos, saldoCentimos, estado });
  }

  private async mustGet(id: string): Promise<Sale> {
    const sale = await this.repo.getSale(id);
    if (!sale) throw new Error(`Venta ${id} no encontrada.`);
    return sale;
  }
}
