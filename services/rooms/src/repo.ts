import { and, eq, isNotNull, lte } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";
import type { Attribute, Category, Floor, Room } from "@casacarlos/contracts";

type FloorRow = typeof schema.roomsPisos.$inferSelect;
type CategoryRow = typeof schema.roomsCategorias.$inferSelect;
type AttributeRow = typeof schema.roomsAtributos.$inferSelect;
type RoomRow = typeof schema.roomsCuartos.$inferSelect;

const toFloor = (r: FloorRow): Floor => ({ id: r.id, numero: r.numero, nombre: r.nombre, orden: r.orden, activo: r.activo });
const toAttribute = (r: AttributeRow): Attribute => ({ id: r.id, nombre: r.nombre });
const toRoom = (r: RoomRow): Room => ({
  id: r.id,
  numero: r.numero,
  pisoId: r.pisoId,
  categoriaId: r.categoriaId,
  descripcion: r.descripcion,
  incluye: r.incluye,
  fueraDeServicio: r.fueraDeServicio,
  motivoFueraServicio: r.motivoFueraServicio,
  limpiezaHasta: r.limpiezaHasta,
  activo: r.activo,
  creadoEn: r.creadoEn,
});

export class RoomsRepo {
  constructor(private readonly db: Db) {}

  async insertFloor(row: FloorRow): Promise<Floor> {
    await this.db.insert(schema.roomsPisos).values(row);
    return toFloor(row);
  }

  async listFloors(): Promise<Floor[]> {
    const rows = await this.db.select().from(schema.roomsPisos).where(eq(schema.roomsPisos.activo, true)).all();
    return rows.map(toFloor);
  }

  async insertAttribute(row: AttributeRow): Promise<Attribute> {
    await this.db.insert(schema.roomsAtributos).values(row);
    return toAttribute(row);
  }

  async listAttributes(): Promise<Attribute[]> {
    const rows = await this.db.select().from(schema.roomsAtributos).all();
    return rows.map(toAttribute);
  }

  async insertCategory(row: CategoryRow, atributoIds: string[]): Promise<Category> {
    await this.db.insert(schema.roomsCategorias).values(row);
    for (const atributoId of atributoIds) {
      await this.db.insert(schema.roomsCategoriaAtributos).values({ categoriaId: row.id, atributoId });
    }
    return { id: row.id, nombre: row.nombre, descripcion: row.descripcion, camas: row.camas, ventiladores: row.ventiladores, atributoIds, activo: row.activo };
  }

  async getCategory(id: string): Promise<Category | null> {
    const c = await this.db.select().from(schema.roomsCategorias).where(eq(schema.roomsCategorias.id, id)).get();
    if (!c) return null;
    const links = await this.db.select().from(schema.roomsCategoriaAtributos).where(eq(schema.roomsCategoriaAtributos.categoriaId, id)).all();
    return { id: c.id, nombre: c.nombre, descripcion: c.descripcion, camas: c.camas, ventiladores: c.ventiladores, atributoIds: links.map((l) => l.atributoId), activo: c.activo };
  }

  /**
   * Sin filtro por `activo`: una categoría desactivada tiene que poder seguir
   * mostrándose para los cuartos que ya la usan (si no, esos cuartos se
   * quedarían sin nombre de categoría en el tablero). El filtro a "solo
   * seleccionables" se hace en la UI al crear un cuarto nuevo.
   */
  async listCategories(): Promise<Category[]> {
    const categorias = await this.db.select().from(schema.roomsCategorias).all();
    const links = await this.db.select().from(schema.roomsCategoriaAtributos).all();
    return categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      camas: c.camas,
      ventiladores: c.ventiladores,
      atributoIds: links.filter((l) => l.categoriaId === c.id).map((l) => l.atributoId),
      activo: c.activo,
    }));
  }

  async updateCategory(id: string, patch: Partial<CategoryRow>, atributoIds?: string[]): Promise<Category> {
    if (Object.keys(patch).length > 0) {
      await this.db.update(schema.roomsCategorias).set(patch).where(eq(schema.roomsCategorias.id, id));
    }
    if (atributoIds !== undefined) {
      await this.db.delete(schema.roomsCategoriaAtributos).where(eq(schema.roomsCategoriaAtributos.categoriaId, id));
      for (const atributoId of atributoIds) {
        await this.db.insert(schema.roomsCategoriaAtributos).values({ categoriaId: id, atributoId });
      }
    }
    const updated = await this.getCategory(id);
    if (!updated) throw new Error(`Categoría ${id} no encontrada tras actualizar.`);
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.db.delete(schema.roomsCategoriaAtributos).where(eq(schema.roomsCategoriaAtributos.categoriaId, id));
    await this.db.delete(schema.roomsCategorias).where(eq(schema.roomsCategorias.id, id));
  }

  async countRoomsInCategory(categoriaId: string): Promise<number> {
    const rows = await this.db.select().from(schema.roomsCuartos).where(eq(schema.roomsCuartos.categoriaId, categoriaId)).all();
    return rows.length;
  }

  async insertRoom(row: RoomRow): Promise<Room> {
    await this.db.insert(schema.roomsCuartos).values(row);
    return toRoom(row);
  }

  async getRoom(id: string): Promise<Room | null> {
    const row = await this.db.select().from(schema.roomsCuartos).where(eq(schema.roomsCuartos.id, id)).get();
    return row ? toRoom(row) : null;
  }

  async listRooms(): Promise<Room[]> {
    const rows = await this.db.select().from(schema.roomsCuartos).where(eq(schema.roomsCuartos.activo, true)).all();
    return rows.map(toRoom);
  }

  /** Incluye los dados de baja — para el módulo de gestión, donde hace falta poder reactivarlos. */
  async listAllRooms(): Promise<Room[]> {
    const rows = await this.db.select().from(schema.roomsCuartos).all();
    return rows.map(toRoom);
  }

  async updateRoom(id: string, patch: Partial<RoomRow>): Promise<Room> {
    await this.db.update(schema.roomsCuartos).set(patch).where(eq(schema.roomsCuartos.id, id));
    const updated = await this.getRoom(id);
    if (!updated) throw new Error(`Cuarto ${id} no encontrado tras actualizar.`);
    return updated;
  }

  /** Rooms whose cleaning window has elapsed but haven't been cleared yet. */
  async listCleaningDue(now: Date): Promise<Room[]> {
    const rows = await this.db
      .select()
      .from(schema.roomsCuartos)
      .where(and(isNotNull(schema.roomsCuartos.limpiezaHasta), lte(schema.roomsCuartos.limpiezaHasta, now.toISOString())))
      .all();
    return rows.map(toRoom);
  }

  async insertHistorial(row: typeof schema.roomsHistorialEstado.$inferSelect): Promise<void> {
    await this.db.insert(schema.roomsHistorialEstado).values(row);
  }
}
