import { migrate } from "drizzle-orm/sqlite-proxy/migrator";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { Db } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function runMigrations(db: Db, sqlite: DatabaseSync): Promise<void> {
  await migrate(
    db,
    async (queries) => {
      for (const query of queries) sqlite.exec(query);
    },
    { migrationsFolder: resolve(__dirname, "../migrations") },
  );
}
