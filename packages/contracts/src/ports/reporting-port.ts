import type { DashboardReport } from "../entities/reporting.js";
import type { DateRange } from "../entities/common.js";

/**
 * Public surface of `reporting`. The one deliberate exception to "no
 * cross-schema reads": this service queries `sales_*`, `payments_*`,
 * `stays_*`, `rooms_*` and `inventory_*` tables directly instead of going
 * through each service's port. A report needs SQL-level aggregation (GROUP
 * BY, date-range scans) across everyone else's data — recreating that with
 * projections fed by events, or by pulling full row lists through five
 * different ports and reducing in memory, buys nothing at this scale and
 * costs real complexity. It never writes to another service's tables, only
 * reads. See docs/ARQUITECTURA.md §1 — this is also the natural first
 * service to extract to a read replica if that boundary ever needs to be
 * real.
 */
export interface ReportingPort {
  getDashboard(range: DateRange): Promise<DashboardReport>;
}
