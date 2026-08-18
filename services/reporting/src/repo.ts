import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";

const BLOCKING_STATES = ["RESERVADA", "EN_CURSO", "EN_TOLERANCIA", "EXCEDIDA", "FINALIZADA"] as const;

/**
 * Reads `sales_*`, `payments_*`, `stays_*`, `rooms_*`, `pricing_*`,
 * `inventory_*` and `identity_*` directly — see the doc comment on
 * `ReportingPort` for why this service is exempt from the "own your tables"
 * rule the rest of the system follows.
 */
export class ReportingRepo {
  constructor(private readonly db: Db) {}

  async salesInRange(startIso: string, endIso: string) {
    return this.db
      .select()
      .from(schema.salesVentas)
      .where(and(gte(schema.salesVentas.creadoEn, startIso), lte(schema.salesVentas.creadoEn, endIso), ne(schema.salesVentas.estado, "ANULADA")))
      .all();
  }

  async linesForSales(ventaIds: string[]) {
    if (ventaIds.length === 0) return [];
    return this.db
      .select()
      .from(schema.salesLineas)
      .where(and(inArray(schema.salesLineas.ventaId, ventaIds), eq(schema.salesLineas.anulada, false)))
      .all();
  }

  /** Pagos aceptados en el rango (por `aceptadoEn`, no por creación) con su desglose por método. */
  async acceptedPaymentDetailsInRange(startIso: string, endIso: string) {
    const pagos = await this.db
      .select({ id: schema.paymentsPagos.id })
      .from(schema.paymentsPagos)
      .where(and(eq(schema.paymentsPagos.estado, "ACEPTADO"), gte(schema.paymentsPagos.aceptadoEn, startIso), lte(schema.paymentsPagos.aceptadoEn, endIso)))
      .all();
    if (pagos.length === 0) return [];
    return this.db
      .select()
      .from(schema.paymentsDetalles)
      .where(inArray(schema.paymentsDetalles.pagoId, pagos.map((p) => p.id)))
      .all();
  }

  /** Estadías no anuladas cuyo bloqueo se cruza con el rango — para ocupación y horas pico. */
  async staysOverlapping(startIso: string, endIso: string) {
    return this.db
      .select()
      .from(schema.staysEstadias)
      .where(and(inArray(schema.staysEstadias.estado, [...BLOCKING_STATES]), lte(schema.staysEstadias.bloqueoDesde, endIso), gte(schema.staysEstadias.bloqueoHasta, startIso)))
      .all();
  }

  async activeRooms() {
    return this.db.select().from(schema.roomsCuartos).where(eq(schema.roomsCuartos.activo, true)).all();
  }

  async floors() {
    return this.db.select().from(schema.roomsPisos).all();
  }

  async categories() {
    return this.db.select().from(schema.roomsCategorias).all();
  }

  async modalities() {
    return this.db.select().from(schema.pricingModalidades).all();
  }

  async charges() {
    return this.db.select().from(schema.pricingCargos).all();
  }

  async users() {
    return this.db.select().from(schema.identityUsuarios).all();
  }

  async products() {
    return this.db.select().from(schema.inventoryProductos).all();
  }
}
