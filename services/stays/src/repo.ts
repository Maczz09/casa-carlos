import { and, eq, inArray, lte } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";
import type { Customer, Stay, StayWithCustomer } from "@casacarlos/contracts";

type CustomerRow = typeof schema.staysClientes.$inferSelect;
type StayRow = typeof schema.staysEstadias.$inferSelect;

const BLOCKING_STATES = ["RESERVADA", "EN_CURSO", "EN_TOLERANCIA", "EXCEDIDA"] as const;

const toCustomer = (r: CustomerRow): Customer => ({ id: r.id, nombres: r.nombres, apellidos: r.apellidos, dni: r.dni, telefono: r.telefono });
const toStay = (r: StayRow): Stay => ({
  id: r.id,
  cuartoId: r.cuartoId,
  clienteId: r.clienteId,
  modalidadId: r.modalidadId,
  ventaId: r.ventaId,
  tipo: r.tipo,
  estado: r.estado,
  bloqueoDesde: r.bloqueoDesde,
  bloqueoHasta: r.bloqueoHasta,
  checkinPrevisto: r.checkinPrevisto,
  checkinReal: r.checkinReal,
  checkoutPrevisto: r.checkoutPrevisto,
  checkoutReal: r.checkoutReal,
  noches: r.noches,
  toleranciaMin: r.toleranciaMin,
  notificadoExcesoEn: r.notificadoExcesoEn,
  motivoAnulacion: r.motivoAnulacion,
  usuarioId: r.usuarioId,
  creadoEn: r.creadoEn,
});

export class StaysRepo {
  constructor(private readonly db: Db) {}

  async findCustomerByDni(dni: string): Promise<Customer | null> {
    const row = await this.db.select().from(schema.staysClientes).where(eq(schema.staysClientes.dni, dni)).get();
    return row ? toCustomer(row) : null;
  }

  async insertCustomer(row: CustomerRow): Promise<Customer> {
    await this.db.insert(schema.staysClientes).values(row);
    return toCustomer(row);
  }

  async updateCustomer(id: string, data: Pick<CustomerRow, "nombres" | "apellidos" | "telefono">): Promise<Customer> {
    await this.db.update(schema.staysClientes).set(data).where(eq(schema.staysClientes.id, id));
    const row = await this.db.select().from(schema.staysClientes).where(eq(schema.staysClientes.id, id)).get();
    return toCustomer(row!);
  }

  async insertStay(row: StayRow): Promise<Stay> {
    await this.db.insert(schema.staysEstadias).values(row);
    return toStay(row);
  }

  async getStay(id: string): Promise<Stay | null> {
    const row = await this.db.select().from(schema.staysEstadias).where(eq(schema.staysEstadias.id, id)).get();
    return row ? toStay(row) : null;
  }

  async updateStay(id: string, patch: Partial<StayRow>): Promise<Stay> {
    await this.db.update(schema.staysEstadias).set(patch).where(eq(schema.staysEstadias.id, id));
    const updated = await this.getStay(id);
    if (!updated) throw new Error(`Estadía ${id} no encontrada tras actualizar.`);
    return updated;
  }

  /** Non-final stays for a room — used both for "is currently active" and for overlap checks. */
  async listBlockingForRoom(roomId: string): Promise<Stay[]> {
    const rows = await this.db
      .select()
      .from(schema.staysEstadias)
      .where(and(eq(schema.staysEstadias.cuartoId, roomId), inArray(schema.staysEstadias.estado, [...BLOCKING_STATES])))
      .all();
    return rows.map(toStay);
  }

  async listActive(): Promise<Stay[]> {
    const rows = await this.db
      .select()
      .from(schema.staysEstadias)
      .where(inArray(schema.staysEstadias.estado, [...BLOCKING_STATES]))
      .all();
    return rows.map(toStay);
  }

  async listEnCursoDue(now: Date): Promise<Stay[]> {
    const rows = await this.db
      .select()
      .from(schema.staysEstadias)
      .where(and(eq(schema.staysEstadias.estado, "EN_CURSO"), lte(schema.staysEstadias.checkoutPrevisto, now.toISOString())))
      .all();
    return rows.map(toStay);
  }

  async listEnTolerancia(): Promise<Stay[]> {
    const rows = await this.db.select().from(schema.staysEstadias).where(eq(schema.staysEstadias.estado, "EN_TOLERANCIA")).all();
    return rows.map(toStay);
  }

  async withCustomer(stay: Stay): Promise<StayWithCustomer> {
    const row = await this.db.select().from(schema.staysClientes).where(eq(schema.staysClientes.id, stay.clienteId)).get();
    if (!row) throw new Error(`Cliente ${stay.clienteId} no encontrado.`);
    return { ...stay, cliente: toCustomer(row) };
  }
}

export { BLOCKING_STATES };
