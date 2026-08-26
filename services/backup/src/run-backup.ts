import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { BackupConfig } from "./config.js";

const FILE_PREFIX = "casacarlos-";
const FILE_SUFFIX = ".db";
const IMAGES_SUFFIX = "-product-images";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fileNameFor(date: Date): string {
  return `${FILE_PREFIX}${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}${FILE_SUFFIX}`;
}

/** ¿Ya tocaba el respaldo de hoy y todavía no corrió? La carpeta de destino misma es la fuente de verdad de "¿ya corrió hoy?" — no hace falta un marcador aparte. */
function isDue(config: BackupConfig, now: Date, fileName: string): boolean {
  const [hh, mm] = config.time.split(":").map(Number) as [number, number];
  const dueAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
  if (now < dueAt) return false;
  return !existsSync(join(config.dir, fileName));
}

/** `VACUUM INTO` no acepta bind de parámetros — el destino va como literal SQL, así que hay que escapar comillas simples a mano. */
function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * `VACUUM INTO` consolida el WAL en un solo archivo limpio — a diferencia de
 * copiar `casacarlos.db` a secas (que en modo WAL puede tener casi todos los
 * datos reales todavía en `.db-wal`, sin checkpoint). Rehúsa sobreescribir un
 * archivo existente, lo cual es una red de seguridad extra si el chequeo de
 * "ya tocaba" alguna vez se dispara dos veces.
 */
function vacuumInto(sqlite: DatabaseSync, destDir: string, fileName: string): void {
  mkdirSync(destDir, { recursive: true });
  const destPath = join(destDir, fileName);
  sqlite.exec(`VACUUM INTO '${escapeSqlLiteral(destPath)}'`);
}

function pruneOld(destDir: string, retentionDays: number, now: Date): void {
  if (!existsSync(destDir)) return;
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  for (const entry of readdirSync(destDir)) {
    if (!entry.startsWith(FILE_PREFIX) || (!entry.endsWith(FILE_SUFFIX) && !entry.endsWith(IMAGES_SUFFIX))) continue;
    const suffix = entry.endsWith(FILE_SUFFIX) ? FILE_SUFFIX : IMAGES_SUFFIX;
    const dateStr = entry.slice(FILE_PREFIX.length, -suffix.length);
    const fileDate = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(fileDate.getTime())) continue; // no sigue nuestra convención de nombre — no tocarlo
    if (fileDate.getTime() < cutoff) {
      const target = resolve(destDir, entry);
      const rel = relative(resolve(destDir), target);
      if (rel.startsWith("..") || rel === "") continue;
      if (suffix === FILE_SUFFIX) unlinkSync(target);
      else rmSync(target, { recursive: true, force: true });
    }
  }
}

function backupProductImages(sourceDir: string | null, destDir: string, fileName: string): void {
  if (!sourceDir || !existsSync(sourceDir)) return;
  const datePart = fileName.slice(FILE_PREFIX.length, -FILE_SUFFIX.length);
  const destination = join(destDir, `${FILE_PREFIX}${datePart}${IMAGES_SUFFIX}`);
  if (existsSync(destination)) return;
  mkdirSync(destDir, { recursive: true });
  cpSync(sourceDir, destination, { recursive: true, errorOnExist: true });
}

/** Corre el respaldo del día si ya tocaba y no se hizo todavía — ver `isDue`. No hace nada si no tocaba. */
export async function runDueBackup(sqlite: DatabaseSync, config: BackupConfig, now: Date = new Date(), productImagesDir: string | null = null): Promise<void> {
  const fileName = fileNameFor(now);
  if (!isDue(config, now, fileName)) return;

  vacuumInto(sqlite, config.dir, fileName);
  backupProductImages(productImagesDir, config.dir, fileName);
  pruneOld(config.dir, config.retentionDays, now);

  if (config.secondaryDir) {
    // Chequeo independiente, no asumir que "tocaba en el primario" implica "tocaba en el secundario":
    // si el secundario quedó desincronizado (alguien copió el archivo de hoy ahí a mano, o un intento
    // anterior falló a mitad de camino), VACUUM INTO se niega a pisar un archivo existente y tira una
    // excepción — sin este chequeo, eso tumbaría también el respaldo del primario (que ya había
    // terminado bien) porque runDueBackup entero no vuelve a correr hasta mañana una vez que el
    // primario ya tiene el archivo de hoy.
    if (!existsSync(join(config.secondaryDir, fileName))) {
      vacuumInto(sqlite, config.secondaryDir, fileName);
    }
    backupProductImages(productImagesDir, config.secondaryDir, fileName);
    pruneOld(config.secondaryDir, config.retentionDays, now);
  }

  console.log(`[backup] respaldo del día completado: ${fileName}`);
}
