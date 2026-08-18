import { join, resolve } from "node:path";

export interface BackupConfig {
  /** Hora local del día en que corre el respaldo, "HH:MM". */
  time: string;
  /** Carpeta principal de destino — absoluta. */
  dir: string;
  /** Segunda carpeta opcional (USB, o una carpeta sincronizada a la nube tipo Google Drive/Dropbox — ya se ve como una carpeta normal, sin API de nube). `null` si no está configurada. */
  secondaryDir: string | null;
  /** Cuántos días de respaldos se conservan antes de podar los más viejos. */
  retentionDays: number;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function parseTime(raw: string, envVar: string): string {
  if (!TIME_RE.test(raw)) {
    throw new Error(`${envVar}="${raw}" inválido — usa formato HH:MM (24 horas), ej. "03:00".`);
  }
  return raw;
}

/** Lee la config de respaldo desde el entorno. `dataDir` es la misma carpeta `data/` que ya usa el resto del server (ver `apps/server/src/index.ts`) — el destino por defecto vive adentro, en `data/backups`. */
export function loadBackupConfig(dataDir: string): BackupConfig {
  const time = parseTime(process.env.BACKUP_TIME ?? "03:00", "BACKUP_TIME");
  const dir = process.env.BACKUP_DIR ? resolve(process.env.BACKUP_DIR) : join(dataDir, "backups");
  const secondaryDir = process.env.BACKUP_DIR_SECONDARY ? resolve(process.env.BACKUP_DIR_SECONDARY) : null;
  const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS ?? 14);
  if (!Number.isInteger(retentionDays) || retentionDays < 1) {
    throw new Error(`BACKUP_RETENTION_DAYS="${process.env.BACKUP_RETENTION_DAYS}" inválido — debe ser un entero positivo.`);
  }
  return { time, dir, secondaryDir, retentionDays };
}
