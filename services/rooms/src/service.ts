import type { Db } from "@casacarlos/db";
import { recordAudit } from "@casacarlos/db";
import { newId } from "@casacarlos/contracts";
import type {
  Attribute,
  Category,
  CreateCategoryInput,
  CreateFloorInput,
  CreateRoomInput,
  Floor,
  FloorBoard,
  Room,
  RoomsPort,
  RoomStatus,
  StaysPort,
  UpdateCategoryInput,
  UpdateRoomInput,
} from "@casacarlos/contracts";
import type { EventBus } from "@casacarlos/bus";
import { RoomsRepo } from "./repo.js";
import { countsTowardFloor, deriveRoomStatus, isAvailableForBoard } from "./domain/derive-status.js";

const DEFAULT_CLEANING_MINUTES = 5;

export class RoomsService implements RoomsPort {
  private readonly repo: RoomsRepo;

  /**
   * Lazy on purpose: `rooms` needs read access to `stays` to compute the
   * status it displays, and `stays` needs `rooms` to validate availability
   * before a check-in. Neither package imports the other's implementation —
   * apps/server wires both instances together after both exist, breaking the
   * construction-order cycle without a package-level import cycle.
   */
  constructor(
    private readonly db: Db,
    private readonly bus: EventBus,
    private readonly getStaysPort: () => StaysPort,
  ) {
    this.repo = new RoomsRepo(db);
  }

  async createFloor(input: CreateFloorInput): Promise<Floor> {
    const floor = await this.repo.insertFloor({ id: newId(), numero: input.numero, nombre: input.nombre, orden: input.orden, activo: true });
    await this.bus.publish("room.catalog_changed", {});
    return floor;
  }

  async listFloors(): Promise<Floor[]> {
    return this.repo.listFloors();
  }

  async createAttribute(nombre: string): Promise<Attribute> {
    return this.repo.insertAttribute({ id: newId(), nombre });
  }

  async listAttributes() {
    return this.repo.listAttributes();
  }

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const category = await this.repo.insertCategory(
      { id: newId(), nombre: input.nombre, descripcion: input.descripcion ?? null, camas: input.camas ?? 1, ventiladores: input.ventiladores ?? 0, activo: true },
      input.atributoIds ?? [],
    );
    await this.bus.publish("room.catalog_changed", {});
    return category;
  }

  async updateCategory(id: string, patch: UpdateCategoryInput): Promise<Category> {
    const current = await this.repo.getCategory(id);
    if (!current) throw new Error(`Categoría ${id} no encontrada.`);
    const updated = await this.repo.updateCategory(
      id,
      {
        ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
        ...(patch.descripcion !== undefined ? { descripcion: patch.descripcion } : {}),
        ...(patch.camas !== undefined ? { camas: patch.camas } : {}),
        ...(patch.ventiladores !== undefined ? { ventiladores: patch.ventiladores } : {}),
        ...(patch.activo !== undefined ? { activo: patch.activo } : {}),
      },
      patch.atributoIds,
    );
    // Cambiar camas/ventiladores no toca ningún cuarto, pero SÍ cambia lo que
    // se dibuja para todos los cuartos de esta categoría — el tablero tiene
    // que recalcularse igual que si hubiera cambiado un cuarto en sí.
    await this.bus.publish("room.catalog_changed", {});
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    const current = await this.repo.getCategory(id);
    if (!current) throw new Error(`Categoría ${id} no encontrada.`);
    const enUso = await this.repo.countRoomsInCategory(id);
    if (enUso > 0) throw new Error(`No se puede borrar: ${enUso} cuarto${enUso === 1 ? "" : "s"} usa${enUso === 1 ? "" : "n"} esta categoría.`);
    await this.repo.deleteCategory(id);
    await this.bus.publish("room.catalog_changed", {});
  }

  async listCategories(): Promise<Category[]> {
    return this.repo.listCategories();
  }

  async createRoom(input: CreateRoomInput): Promise<Room> {
    const room = await this.repo.insertRoom({
      id: newId(),
      numero: input.numero,
      pisoId: input.pisoId,
      categoriaId: input.categoriaId,
      descripcion: input.descripcion ?? null,
      incluye: input.incluye ?? null,
      fueraDeServicio: false,
      motivoFueraServicio: null,
      limpiezaHasta: null,
      activo: true,
      creadoEn: new Date().toISOString(),
    });
    await this.bus.publish("room.catalog_changed", {});
    return room;
  }

  async updateRoom(id: string, patch: UpdateRoomInput): Promise<Room> {
    const updated = await this.repo.updateRoom(id, {
      ...(patch.numero !== undefined ? { numero: patch.numero } : {}),
      ...(patch.pisoId !== undefined ? { pisoId: patch.pisoId } : {}),
      ...(patch.categoriaId !== undefined ? { categoriaId: patch.categoriaId } : {}),
      ...(patch.descripcion !== undefined ? { descripcion: patch.descripcion } : {}),
      ...(patch.incluye !== undefined ? { incluye: patch.incluye } : {}),
      ...(patch.activo !== undefined ? { activo: patch.activo } : {}),
    });
    await this.bus.publish("room.catalog_changed", {});
    return updated;
  }

  async deleteRoom(id: string): Promise<void> {
    const activeStay = await this.getStaysPort().getActiveStay(id);
    if (activeStay) throw new Error("No se puede dar de baja un cuarto con una estadía activa — hacé el check-out primero.");
    await this.repo.updateRoom(id, { activo: false });
    await this.bus.publish("room.catalog_changed", {});
  }

  async getRoom(id: string): Promise<Room> {
    const room = await this.repo.getRoom(id);
    if (!room) throw new Error(`Cuarto ${id} no encontrado.`);
    return room;
  }

  async listRooms(): Promise<Room[]> {
    return this.repo.listRooms();
  }

  async listAllRooms(): Promise<Room[]> {
    return this.repo.listAllRooms();
  }

  async getRoomStatus(roomId: string): Promise<RoomStatus> {
    const room = await this.getRoom(roomId);
    const activeStay = await this.getStaysPort().getActiveStay(roomId);
    return deriveRoomStatus(room, activeStay, new Date());
  }

  async getBoard(forKiosk: boolean): Promise<FloorBoard[]> {
    const [floors, rooms] = [await this.repo.listFloors(), await this.repo.listRooms()];
    const now = new Date();
    const stays = this.getStaysPort();

    const entries = await Promise.all(
      rooms.map(async (room) => {
        const activeStay = await stays.getActiveStay(room.id);
        const estado = deriveRoomStatus(room, activeStay, now);
        return {
          room,
          estado,
          clienteNombre: !forKiosk && activeStay ? `${activeStay.cliente.nombres} ${activeStay.cliente.apellidos}` : null,
          stayId: !forKiosk && activeStay ? activeStay.id : null,
          desocupaEn: activeStay ? activeStay.checkoutPrevisto : null,
          limpiezaHasta: room.limpiezaHasta,
        };
      }),
    );

    return floors
      .sort((a, b) => a.orden - b.orden)
      .map((floor) => {
        const floorRooms = entries.filter((e) => e.room.pisoId === floor.id);
        const relevant = floorRooms.filter((e) => countsTowardFloor(e.estado));
        const semaforo = relevant.some((e) => isAvailableForBoard(e.estado)) ? ("VERDE" as const) : ("ROJO" as const);
        return { floor, semaforo, rooms: floorRooms };
      });
  }

  async markCleaning(roomId: string, usuarioId: string, minutes = DEFAULT_CLEANING_MINUTES): Promise<Room> {
    const before = await this.getRoomStatus(roomId);
    const hasta = new Date(Date.now() + minutes * 60_000).toISOString();
    const room = await this.repo.updateRoom(roomId, { limpiezaHasta: hasta });
    await this.transition(roomId, before, "LIMPIEZA", usuarioId);
    await this.bus.publish("room.cleaning_started", { roomId, until: hasta });
    return room;
  }

  async finishCleaning(roomId: string): Promise<Room> {
    const room = await this.repo.updateRoom(roomId, { limpiezaHasta: null });
    const after = await this.getRoomStatus(roomId);
    await this.transition(roomId, "LIMPIEZA", after, null);
    await this.bus.publish("room.cleaning_finished", { roomId });
    return room;
  }

  async setOutOfService(roomId: string, motivo: string, usuarioId: string): Promise<Room> {
    const before = await this.getRoomStatus(roomId);
    const room = await this.repo.updateRoom(roomId, { fueraDeServicio: true, motivoFueraServicio: motivo });
    await this.transition(roomId, before, "FUERA_DE_SERVICIO", usuarioId);
    await recordAudit(this.db, { entidad: "rooms_cuartos", entidadId: roomId, accion: "FUERA_DE_SERVICIO", usuarioId, motivo });
    return room;
  }

  async returnToService(roomId: string, usuarioId: string): Promise<Room> {
    const room = await this.repo.updateRoom(roomId, { fueraDeServicio: false, motivoFueraServicio: null });
    const after = await this.getRoomStatus(roomId);
    await this.transition(roomId, "FUERA_DE_SERVICIO", after, usuarioId);
    return room;
  }

  async assertAvailable(roomId: string): Promise<void> {
    const status = await this.getRoomStatus(roomId);
    if (status !== "DISPONIBLE") {
      throw new Error(`El cuarto no está disponible (estado actual: ${status}).`);
    }
  }

  async runTimers(now: Date): Promise<{ finishedCleaning: string[] }> {
    const due = await this.repo.listCleaningDue(now);
    const finishedCleaning: string[] = [];
    for (const room of due) {
      await this.finishCleaning(room.id);
      finishedCleaning.push(room.id);
    }
    return { finishedCleaning };
  }

  private async transition(roomId: string, from: RoomStatus, to: RoomStatus, usuarioId: string | null): Promise<void> {
    await this.repo.insertHistorial({
      id: newId(),
      cuartoId: roomId,
      estadoAnterior: from,
      estadoNuevo: to,
      estadiaId: null,
      usuarioId,
      ocurridoEn: new Date().toISOString(),
    });
    await this.bus.publish("room.status_changed", { roomId, from, to });
  }
}
