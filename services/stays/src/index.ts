import type { Db } from "@casacarlos/db";
import type { EventBus } from "@casacarlos/bus";
import type { PricingPort, RoomsPort, StaysPort } from "@casacarlos/contracts";
import { StaysService } from "./service.js";

export function createStaysService(db: Db, bus: EventBus, rooms: RoomsPort, pricing: PricingPort): StaysPort {
  return new StaysService(db, bus, rooms, pricing);
}

export type { StaysPort } from "@casacarlos/contracts";
