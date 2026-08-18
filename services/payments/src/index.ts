import type { Db } from "@casacarlos/db";
import type { EventBus } from "@casacarlos/bus";
import type { PaymentsPort, SalesPort } from "@casacarlos/contracts";
import { PaymentsService } from "./service.js";

export function createPaymentsService(db: Db, bus: EventBus, sales: SalesPort): PaymentsPort {
  return new PaymentsService(db, bus, sales);
}

export type { PaymentsPort } from "@casacarlos/contracts";
