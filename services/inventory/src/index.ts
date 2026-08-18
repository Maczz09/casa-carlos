import type { Db } from "@casacarlos/db";
import type { EventBus } from "@casacarlos/bus";
import type { InventoryPort } from "@casacarlos/contracts";
import { InventoryService } from "./service.js";

export function createInventoryService(db: Db, bus: EventBus): InventoryPort {
  return new InventoryService(db, bus);
}

export type { InventoryPort } from "@casacarlos/contracts";
