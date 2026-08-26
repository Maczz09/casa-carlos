import type { RoomStatus } from "./entities/rooms.js";

/**
 * Every cross-service reaction goes through this map — never a direct import
 * of another service's implementation. `InProcessBus` (packages/bus) is the
 * only thing that reads it; when a service is extracted to its own process,
 * this map becomes the wire contract too.
 */
export type DomainEvents = {
  "room.status_changed": { roomId: string; from: RoomStatus; to: RoomStatus };
  "room.cleaning_started": { roomId: string; until: string };
  "room.cleaning_finished": { roomId: string };
  /** Cuarto o categoría creado/editado/borrado — no importa cuál, solo que el tablero (WS) tiene que recalcularse. */
  "room.catalog_changed": Record<string, never>;

  "stay.reserved": { stayId: string; roomId: string; from: string; to: string };
  "stay.checked_in": { stayId: string; roomId: string; modalidadId: string; at: string };
  "stay.tolerance_started": { stayId: string; roomId: string; deadline: string };
  "stay.overstayed": { stayId: string; roomId: string; minutesOver: number };
  "stay.checked_out": { stayId: string; roomId: string; at: string };
  "stay.cancelled": { stayId: string; roomId: string; motivo: string };

  "sale.opened": { saleId: string; usuarioId: string };
  "sale.line_added": { saleId: string; lineId: string; phase: "PRE_PAGO" | "POST_PAGO" };
  "sale.paid": { saleId: string; totalCentimos: number };
  "sale.closed": { saleId: string };

  "payment.accepted": { paymentId: string; saleId: string; totalCentimos: number; aceptadoPor: string };
  "payment.rejected": { paymentId: string; saleId: string; motivo: string };

  "inventory.low_stock": { productoId: string; nombre: string; stock: number; stockMinimo: number };
  "inventory.dispatched": { productoId: string; cantidad: number; lineaVentaId: string | null };
  /** Producto, precio, imagen, categoría o stock cambió; refrescar catálogos conectados. */
  "inventory.catalog_changed": { productoId: string | null };

  "shift.opened": { turnoId: string; usuarioId: string };
  "shift.closed": { turnoId: string; usuarioId: string; diferenciaCentimos: number };
};

export type DomainEventName = keyof DomainEvents;
