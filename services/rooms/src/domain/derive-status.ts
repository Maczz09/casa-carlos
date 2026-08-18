import type { RoomStatus, StayWithCustomer } from "@casacarlos/contracts";

export interface RoomFlags {
  fueraDeServicio: boolean;
  limpiezaHasta: string | null;
}

/**
 * The one place `RoomStatus` gets computed. Never stored as a column — see
 * MODELO-DE-DATOS.md: a stored status column could say "disponible" while a
 * stay is still active. `activeStay` is the blocking stay for this room
 * right now, if any (see StaysRepo.findActiveForRoom).
 */
export function deriveRoomStatus(room: RoomFlags, activeStay: StayWithCustomer | null, now: Date): RoomStatus {
  if (room.fueraDeServicio) return "FUERA_DE_SERVICIO";
  if (room.limpiezaHasta && new Date(room.limpiezaHasta) > now) return "LIMPIEZA";
  if (!activeStay) return "DISPONIBLE";

  switch (activeStay.estado) {
    case "RESERVADA":
      return "RESERVADO";
    case "EN_CURSO":
      return "OCUPADO";
    case "EN_TOLERANCIA":
      return "EN_TOLERANCIA";
    case "EXCEDIDA":
      return "EXCEDIDO";
    default:
      return "DISPONIBLE";
  }
}

/** A cuarto counts toward "available" for the floor traffic light. */
export function isAvailableForBoard(status: RoomStatus): boolean {
  return status === "DISPONIBLE";
}

/** A cuarto counts in the floor's denominator unless it's been pulled from service. */
export function countsTowardFloor(status: RoomStatus): boolean {
  return status !== "FUERA_DE_SERVICIO";
}
