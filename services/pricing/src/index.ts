import type { Db } from "@casacarlos/db";
import type { PricingPort } from "@casacarlos/contracts";
import { PricingService } from "./service.js";

export function createPricingService(db: Db): PricingPort {
  return new PricingService(db);
}

export type { PricingPort } from "@casacarlos/contracts";
