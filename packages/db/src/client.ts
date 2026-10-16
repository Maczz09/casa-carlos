import { DatabaseSync } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema/index.js";
import { AsyncLocalStorage } from "node:async_hooks";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export interface Connection {
  db: Db;
  sqlite: DatabaseSync;
}

const connections = new WeakMap<Db, { sqlite: DatabaseSync; pending: Promise<void> }>();
const transactions = new AsyncLocalStorage<{ db: Db; afterCommit: Array<() => Promise<void>> }>();

/** Serializa las operaciones contables y revierte todas sus escrituras si alguna falla. */
export async function atomic<T>(db: Db, operation: () => Promise<T>): Promise<T> {
  if (transactions.getStore()?.db === db) return operation();
  const connection = connections.get(db);
  if (!connection) throw new Error("Conexión de base de datos no registrada.");
  const previous = connection.pending;
  let release!: () => void;
  connection.pending = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  const context = { db, afterCommit: [] as Array<() => Promise<void>> };
  let result: T;
  try {
    connection.sqlite.exec("BEGIN IMMEDIATE");
    result = await transactions.run(context, operation);
    connection.sqlite.exec("COMMIT");
  } catch (error) {
    if (connection.sqlite.isTransaction) connection.sqlite.exec("ROLLBACK");
    throw error;
  } finally {
    release();
  }
  for (const notify of context.afterCommit) {
    try { await notify(); } catch (error) { console.error("[db] Notificación posterior al commit:", error); }
  }
  return result;
}

export async function afterCommit(db: Db, notify: () => Promise<void>): Promise<void> {
  const context = transactions.getStore();
  if (context?.db === db) context.afterCommit.push(notify);
  else await notify();
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
    // Otras solicitudes esperan el cierre de la transacción: no leen saldos
    // intermedios ni introducen escrituras en una operación ajena.
    if (transactions.getStore()?.db !== db) await connections.get(db)?.pending;
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

  connections.set(db, { sqlite, pending: Promise.resolve() });
  return { db, sqlite };
}

export { schema };
export { sql, eq, and, or, gte, lte, lt, gt, ne, desc, asc, isNull, isNotNull, inArray } from "drizzle-orm";
