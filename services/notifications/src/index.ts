import type { Db } from "@casacarlos/db";
import type { EventBus } from "@casacarlos/bus";
import type { IdentityPort, RoomsPort } from "@casacarlos/contracts";
import { NotificationsRepo } from "./repo.js";
import { NotificationsService } from "./service.js";
import type { NotificationSender } from "./senders/types.js";

export async function createNotificationsService(
  db: Db,
  bus: EventBus,
  rooms: RoomsPort,
  identity: IdentityPort,
  sender: NotificationSender,
): Promise<NotificationsService> {
  const service = new NotificationsService(new NotificationsRepo(db), rooms, identity, sender);
  await service.ensureDefaultTemplates();

  bus.subscribe("stay.overstayed", (payload) => service.handleStayOverstayed(payload));
  bus.subscribe("inventory.low_stock", (payload) => service.handleLowStock(payload));
  bus.subscribe("shift.closed", (payload) => service.handleShiftClosed(payload));

  return service;
}

export { NotificationsService } from "./service.js";
export { startNotificationsWorker } from "./worker.js";
export type { NotificationsWorkerHandle } from "./worker.js";
export { ConsoleSender } from "./senders/console-sender.js";
export { WhatsAppSender } from "./senders/whatsapp-sender.js";
export type { NotificationSender } from "./senders/types.js";
export type { NotificationsPort } from "@casacarlos/contracts";
