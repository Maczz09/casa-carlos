import type { DatabaseSync } from "node:sqlite";
import { loadBackupConfig } from "./config.js";
import { runDueBackup } from "./run-backup.js";

const TICK_MS = 5 * 60_000;

export interface BackupHandle {
  stop(): void;
}

/**
 * Respaldo diario del archivo SQLite — mismo patrón que `services/scheduler`:
 * `tick` nunca deja escapar la excepción hacia arriba (un respaldo fallido no
 * debe tumbar el servidor, solo queda logueado), `void tick()` corre una vez
 * al arrancar para no perder el respaldo del día si el proceso estuvo caído
 * a esa hora, después `setInterval`. `TICK_MS` es de 5 minutos, no segundos
 * como los otros pollers — es un job que corre una vez al día, no hace falta
 * chequear más seguido.
 */
export function startBackupJob(sqlite: DatabaseSync, dataDir: string): BackupHandle {
  const config = loadBackupConfig(dataDir);

  const tick = async () => {
    try {
      await runDueBackup(sqlite, config);
    } catch (err) {
      console.error("[backup] tick falló:", err);
    }
  };

  void tick();
  const interval = setInterval(tick, TICK_MS);

  return { stop: () => clearInterval(interval) };
}

export { loadBackupConfig };
export { runDueBackup };
export type { BackupConfig } from "./config.js";
