import type { Db } from "@casacarlos/db";
import type { EventBus } from "@casacarlos/bus";
import type { RoomsPort, StaysPort } from "@casacarlos/contracts";
import { RoomsService } from "./service.js";

export function createRoomsService(db: Db, bus: EventBus, getStaysPort: () => StaysPort): RoomsPort {
  return new RoomsService(db, bus, getStaysPort);
}

export type { RoomsPort } from "@casacarlos/contracts";
