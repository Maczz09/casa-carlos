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
  ventiladores?: number;
  atributoIds?: string[];
}

export interface UpdateCategoryInput {
  nombre?: string;
  descripcion?: string | null;
  camas?: number;
  ventiladores?: number;
  /** Si se manda, reemplaza la lista completa de atributos — no es un merge. */
  atributoIds?: string[];
  activo?: boolean;
}

export interface CreateRoomInput {
  numero: string;
  pisoId: string;
  categoriaId: string;
  descripcion?: string | null;
  incluye?: string | null;
}

export interface UpdateRoomInput {
  numero?: string;
  pisoId?: string;
  categoriaId?: string;
  descripcion?: string | null;
  incluye?: string | null;
  /** Para reactivar un cuarto dado de baja — `deleteRoom` es lo único que lo pone en `false`. */
  activo?: boolean;
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
  updateCategory(id: string, patch: UpdateCategoryInput): Promise<Category>;
  /** Falla si algún cuarto todavía usa esta categoría. */
  deleteCategory(id: string): Promise<void>;
  listCategories(): Promise<Category[]>;

  createRoom(input: CreateRoomInput): Promise<Room>;
  updateRoom(id: string, patch: UpdateRoomInput): Promise<Room>;
  /** Baja lógica (activo=false) — bloquea si el cuarto tiene una estadía activa. */
  deleteRoom(id: string): Promise<void>;
  getRoom(id: string): Promise<Room>;
  listRooms(): Promise<Room[]>;
  /** Incluye los dados de baja — para el módulo de gestión. `listRooms` (arriba) es el que usa el tablero en vivo. */
  listAllRooms(): Promise<Room[]>;

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
