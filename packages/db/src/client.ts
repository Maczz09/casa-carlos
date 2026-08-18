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

    // Drizzle mapea las columnas POR POSICIÓN, así que las filas tienen que
    // llegar como arrays. No alcanza con `Object.values(row)`: en un JOIN entre
    // tablas con columnas homónimas (id, nombre, creado_en…) las claves del
    // objeto colisionan y la fila pierde columnas enteras, corriendo todo el
    // mapeo — se veía como el nombre de la categoría apareciendo en el nombre
    // del producto. `setReturnArrays` devuelve la fila posicional de verdad.
    stmt.setReturnArrays(true);

    // Los tipos de node:sqlite declaran siempre `Record<string, …>` porque no
    // modelan el modo array de `setReturnArrays`, de ahí el doble cast.
    if (method === "get") {
      const row = stmt.get(...params) as unknown as unknown[] | undefined;
      // `rows: undefined` (y no `[]`) es lo que le dice a Drizzle "no hubo fila":
      // un array vacío es truthy y se leería como una coincidencia sin columnas.
      // El tipo AsyncRemoteCallback no expresa esto, de ahí el cast.
      return { rows: row } as { rows: unknown[] };
    }
    return { rows: stmt.all(...params) as unknown as unknown[][] };
  }, { schema });

  return { db, sqlite };
}

export { schema };
export { sql, eq, and, or, gte, lte, lt, gt, ne, desc, asc, isNull, isNotNull, inArray } from "drizzle-orm";
