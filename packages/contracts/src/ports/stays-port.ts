import type { Customer, Stay, StayWithCustomer } from "../entities/stays.js";

export interface CustomerInput {
  nombres: string;
  apellidos: string;
  dni: string;
  telefono?: string | null;
}

export interface CheckInWalkInInput {
  cuartoId: string;
  modalidadId: string;
  cliente: CustomerInput;
  usuarioId: string;
  /** For HORAS_3, how many 3h blocks to start with (default 1). */
  bloques?: number;
  /** For night modalities, how many nights (default 1). */
  noches?: number;
}

export interface CreateReservationInput {
  cuartoId: string;
  modalidadId: string;
  cliente: CustomerInput;
  reservadaPara: string;
  noches?: number;
  usuarioId: string;
}

/**
 * Public surface of `stays`. Owns the room-occupancy state machine and the
 * only writer of `stays_*`. Reservations/check-ins validate room availability
 * through `RoomsPort.assertAvailable` before committing.
 */
export interface StaysPort {
  createReservation(input: CreateReservationInput): Promise<Stay>;
  checkInWalkIn(input: CheckInWalkInInput): Promise<Stay>;
  checkInReservation(stayId: string, usuarioId: string): Promise<Stay>;

  checkOut(stayId: string, usuarioId: string): Promise<Stay>;
  cancel(stayId: string, motivo: string, usuarioId: string): Promise<Stay>;

  extendByBlock(stayId: string, blocks: number, usuarioId: string): Promise<Stay>;
  addNight(stayId: string, usuarioId: string): Promise<Stay>;

  getStay(id: string): Promise<StayWithCustomer>;
  getActiveStay(roomId: string): Promise<StayWithCustomer | null>;
  listActiveStays(): Promise<StayWithCustomer[]>;

  findOrCreateCustomer(input: CustomerInput): Promise<Customer>;

  /** Scheduler tick: OCUPADO → EN_TOLERANCIA → EXCEDIDA transitions, driven by stored deadlines. */
  runTimers(now: Date): Promise<{ toleranceStarted: string[]; overstayed: string[] }>;
}
