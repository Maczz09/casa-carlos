import type { Db } from "@casacarlos/db";
import type { IdentityPort } from "@casacarlos/contracts";
import { IdentityService } from "./service.js";

export function createIdentityService(db: Db): IdentityPort {
  return new IdentityService(db);
}

export type { IdentityPort } from "@casacarlos/contracts";
