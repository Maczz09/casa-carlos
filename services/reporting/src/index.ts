import type { Db } from "@casacarlos/db";
import type { ReportingPort } from "@casacarlos/contracts";
import { ReportingRepo } from "./repo.js";
import { ReportingService } from "./service.js";

export function createReportingService(db: Db): ReportingPort {
  return new ReportingService(new ReportingRepo(db));
}

export type { ReportingPort } from "@casacarlos/contracts";
