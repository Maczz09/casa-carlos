import type { Db } from "@casacarlos/db";
import type { EventBus } from "@casacarlos/bus";
import type { CashboxPort, PaymentsPort } from "@casacarlos/contracts";
import { CashboxService } from "./service.js";

export function createCashboxService(db: Db, bus: EventBus, payments: PaymentsPort, clock?: () => Date): CashboxPort {
  return new CashboxService(db, bus, payments, clock);
}

export type { CashboxPort } from "@casacarlos/contracts";
