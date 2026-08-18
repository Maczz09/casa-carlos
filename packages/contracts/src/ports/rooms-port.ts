import type { Attribute, Category, Floor, FloorBoard, Room, RoomStatus } from "../entities/rooms.js";

export interface CreateFloorInput {
  numero: number;
  nombre: string;
  orden: number;
}

export interface CreateCategoryInput {
  nombre: string;
  descripcion?: string | null;
  camas?: number;
  atributoIds?: string[];
}

export interface CreateRoomInput {
  numero: string;
  pisoId: string;
  categoriaId: string;
  descripcion?: string | null;
  incluye?: string | null;
}

/**
 * Public surface of the `rooms` service. Everything else (stays, sales,
 * gateway) reads room state and derives status only through this port —
 * never by querying `rooms_*` tables directly.
 */
export interface RoomsPort {
  createFloor(input: CreateFloorInput): Promise<Floor>;
  listFloors(): Promise<Floor[]>;

  createAttribute(nombre: string): Promise<Attribute>;
  listAttributes(): Promise<Attribute[]>;

  createCategory(input: CreateCategoryInput): Promise<Category>;
  listCategories(): Promise<Category[]>;

  createRoom(input: CreateRoomInput): Promise<Room>;
  getRoom(id: string): Promise<Room>;
  listRooms(): Promise<Room[]>;

  /** Derived status — never a stored column. */
  getRoomStatus(roomId: string): Promise<RoomStatus>;

  /** Full board grouped by floor, with the per-floor traffic light. `forKiosk: true` strips customer names. */
  getBoard(forKiosk: boolean): Promise<FloorBoard[]>;

  markCleaning(roomId: string, usuarioId: string, minutes?: number): Promise<Room>;
  finishCleaning(roomId: string): Promise<Room>;

  setOutOfService(roomId: string, motivo: string, usuarioId: string): Promise<Room>;
  returnToService(roomId: string, usuarioId: string): Promise<Room>;

  /** Called by `stays` before committing a check-in/reservation — the one legitimate cross-service read of room availability. */
  assertAvailable(roomId: string): Promise<void>;

  /** Scheduler tick: releases rooms whose `limpieza_hasta` has elapsed. */
  runTimers(now: Date): Promise<{ finishedCleaning: string[] }>;
}
