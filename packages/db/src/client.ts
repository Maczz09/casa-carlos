import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema/index.js";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface Connection {
  db: Db;
  sqlite: DatabaseSync;
}

/**
 * `better-sqlite3` has no prebuilt binary for current Node releases on
 * Windows and would need a native toolchain to compile from source — the
 * opposite of the zero-install goal this stack was chosen for. Node's
 * built-in `node:sqlite` needs nothing to install, so we drive Drizzle
 * through `sqlite-proxy`: a thin callback adapter, not a network proxy.
 * Every query still runs in-process, synchronously, against the same file.
 */
export function openDatabase(filePath: string): Connection {
  const sqlite = new DatabaseSync(filePath);
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA synchronous = NORMAL");
  sqlite.exec("PRAGMA foreign_keys = ON");
  sqlite.exec("PRAGMA busy_timeout = 5000");

  const db = drizzle(async (sql, params, method) => {
    const stmt = sqlite.prepare(sql);
    if (method === "run") {
      stmt.run(...params);
      return { rows: [] };
    }
    if (method === "get") {
      const row = stmt.get(...params) as Record<string, unknown> | undefined;
      // `rows: undefined` here (not `[]`) is what tells Drizzle "no matching row" —
      // an empty array is truthy and would be read back as a zero-column match.
      // The AsyncRemoteCallback type doesn't express this, hence the cast.
      return { rows: row ? Object.values(row) : undefined } as { rows: unknown[] };
    }
    const rows = stmt.all(...params) as Record<string, unknown>[];
    return { rows: rows.map((r) => Object.values(r)) };
  }, { schema });

  return { db, sqlite };
}

export { schema };
export { sql, eq, and, or, gte, lte, lt, gt, ne, desc, asc, isNull, isNotNull, inArray } from "drizzle-orm";
