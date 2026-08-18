import type { Db } from "@casacarlos/db";
import type { EventBus } from "@casacarlos/bus";
import type { InventoryPort, PricingPort, RoomsPort, SalesPort, StaysPort } from "@casacarlos/contracts";
import { SalesService } from "./service.js";

export function createSalesService(
  db: Db,
  bus: EventBus,
  rooms: RoomsPort,
  pricing: PricingPort,
  stays: StaysPort,
  inventory: InventoryPort,
): SalesPort {
  const service = new SalesService(db, bus, rooms, pricing, stays, inventory);

  bus.subscribe("payment.accepted", (payload) => service.handlePaymentAccepted(payload.saleId, payload.totalCentimos));
  bus.subscribe("payment.rejected", (payload) => service.handlePaymentRejected(payload.saleId));

  return service;
}

export type { SalesPort } from "@casacarlos/contracts";
