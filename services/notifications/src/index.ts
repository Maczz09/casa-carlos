import type { Db } from "@casacarlos/db";
import type { EventBus } from "@casacarlos/bus";
import type { IdentityPort, RoomsPort } from "@casacarlos/contracts";
import { NotificationsRepo } from "./repo.js";
import { NotificationsService } from "./service.js";

export async function createNotificationsService(db: Db, bus: EventBus, rooms: RoomsPort, identity: IdentityPort): Promise<NotificationsService> {
  const service = new NotificationsService(new NotificationsRepo(db), rooms, identity);
  await service.ensureDefaultTemplates();

  bus.subscribe("stay.overstayed", (payload) => service.handleStayOverstayed(payload));
  bus.subscribe("inventory.low_stock", (payload) => service.handleLowStock(payload));
  bus.subscribe("shift.closed", (payload) => service.handleShiftClosed(payload));

  return service;
}

export { NotificationsService } from "./service.js";
export { WhatsAppBridge } from "./whatsapp-bridge.js";
export type { WhatsAppStatus, WhatsAppAgentStatus, WhatsAppAgentOrders } from "./whatsapp-bridge.js";
export type { NotificationsPort } from "@casacarlos/contracts";
