import { newId } from "@casacarlos/contracts";
import type { Db } from "./client.js";
import { schema } from "./client.js";

export interface AuditEntry {
  entidad: string;
  entidadId: string;
  accion: string;
  usuarioId?: string | null;
  antes?: unknown;
  despues?: unknown;
  motivo?: string | null;
}

/** Solo-append write. Called by any service whenever it mutates a sale, stay, or rate. */
export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.insert(schema.auditLog).values({
    id: newId(),
    entidad: entry.entidad,
    entidadId: entry.entidadId,
    accion: entry.accion,
    usuarioId: entry.usuarioId ?? null,
    ocurridoEn: new Date().toISOString(),
    antesJson: entry.antes !== undefined ? JSON.stringify(entry.antes) : null,
    despuesJson: entry.despues !== undefined ? JSON.stringify(entry.despues) : null,
    motivo: entry.motivo ?? null,
  });
}
