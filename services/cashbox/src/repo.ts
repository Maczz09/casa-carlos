import { and, eq, gte, inArray, lte } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";
import type { CashMovement, Shift, ShiftTemplate } from "@casacarlos/contracts";

type TemplateRow = typeof schema.cashboxPlantillasTurno.$inferSelect;
type ShiftRow = typeof schema.cashboxTurnos.$inferSelect;
type MovementRow = typeof schema.cashboxMovimientos.$inferSelect;

const toTemplate = (r: TemplateRow): ShiftTemplate => ({
  id: r.id,
  nombre: r.nombre,
  horaInicio: r.horaInicio,
  horaFin: r.horaFin,
  orden: r.orden,
  activa: r.activa,
});

const toShift = (r: ShiftRow): Shift => ({
  id: r.id,
  plantillaId: r.plantillaId,
  usuarioId: r.usuarioId,
  fecha: r.fecha,
  abiertoEn: r.abiertoEn,
  cerradoEn: r.cerradoEn,
  aperturaCentimos: r.aperturaCentimos,
  efectivoEsperadoCentimos: r.efectivoEsperadoCentimos,
  efectivoDeclaradoCentimos: r.efectivoDeclaradoCentimos,
  diferenciaCentimos: r.diferenciaCentimos,
  justificacion: r.justificacion,
  estado: r.estado,
});

const toMovement = (r: MovementRow): CashMovement => ({
  id: r.id,
  turnoId: r.turnoId,
  tipo: r.tipo,
  metodo: r.metodo,
  montoCentimos: r.montoCentimos,
  ventaId: r.ventaId,
  pagoId: r.pagoId,
  vueltoCentimos: r.vueltoCentimos,
  motivo: r.motivo,
  usuarioId: r.usuarioId,
  ocurridoEn: r.ocurridoEn,
});

export class CashboxRepo {
  constructor(private readonly db: Db) {}

  async insertTemplate(row: TemplateRow): Promise<ShiftTemplate> {
    await this.db.insert(schema.cashboxPlantillasTurno).values(row);
    return toTemplate(row);
  }

  async listTemplates(): Promise<ShiftTemplate[]> {
    const rows = await this.db.select().from(schema.cashboxPlantillasTurno).where(eq(schema.cashboxPlantillasTurno.activa, true)).all();
    return rows.map(toTemplate);
  }

  async insertShift(row: ShiftRow): Promise<Shift> {
    await this.db.insert(schema.cashboxTurnos).values(row);
    return toShift(row);
  }

  async getShift(id: string): Promise<Shift | null> {
    const row = await this.db.select().from(schema.cashboxTurnos).where(eq(schema.cashboxTurnos.id, id)).get();
    return row ? toShift(row) : null;
  }

  async updateShift(id: string, patch: Partial<ShiftRow>): Promise<Shift> {
    await this.db.update(schema.cashboxTurnos).set(patch).where(eq(schema.cashboxTurnos.id, id));
    const updated = await this.getShift(id);
    if (!updated) throw new Error(`Turno ${id} no encontrado tras actualizar.`);
    return updated;
  }

  async findOpenShiftForUser(usuarioId: string): Promise<Shift | null> {
    const row = await this.db
      .select()
      .from(schema.cashboxTurnos)
      .where(and(eq(schema.cashboxTurnos.usuarioId, usuarioId), eq(schema.cashboxTurnos.estado, "ABIERTO")))
      .get();
    return row ? toShift(row) : null;
  }

  async listShifts(range?: { desde: string; hasta: string }): Promise<Shift[]> {
    const rows = range
      ? await this.db.select().from(schema.cashboxTurnos).where(and(gte(schema.cashboxTurnos.fecha, range.desde), lte(schema.cashboxTurnos.fecha, range.hasta))).all()
      : await this.db.select().from(schema.cashboxTurnos).all();
    return rows.map(toShift).sort((a, b) => (a.abiertoEn < b.abiertoEn ? 1 : -1));
  }

  async insertMovement(row: MovementRow): Promise<CashMovement> {
    await this.db.insert(schema.cashboxMovimientos).values(row);
    return toMovement(row);
  }

  async listMovementsForShift(turnoId: string): Promise<CashMovement[]> {
    const rows = await this.db.select().from(schema.cashboxMovimientos).where(eq(schema.cashboxMovimientos.turnoId, turnoId)).all();
    return rows.map(toMovement);
  }

  async listMovementsForShifts(turnoIds: string[]): Promise<CashMovement[]> {
    if (turnoIds.length === 0) return [];
    const rows = await this.db.select().from(schema.cashboxMovimientos).where(inArray(schema.cashboxMovimientos.turnoId, turnoIds)).all();
    return rows.map(toMovement);
  }
}
