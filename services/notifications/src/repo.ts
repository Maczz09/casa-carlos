import { eq } from "drizzle-orm";
import type { Db } from "@casacarlos/db";
import { schema } from "@casacarlos/db";
import type { NotificationEventCode, NotificationQueueItem, NotificationRecipient, NotificationState, NotificationTemplate } from "@casacarlos/contracts";

type RecipientRow = typeof schema.notificationsDestinatarios.$inferSelect;
type TemplateRow = typeof schema.notificationsPlantillas.$inferSelect;
type QueueRow = typeof schema.notificationsCola.$inferSelect;

const toRecipient = (r: RecipientRow): NotificationRecipient => ({
  id: r.id,
  usuarioId: r.usuarioId,
  nombre: r.nombre,
  telefono: r.telefono,
  eventos: JSON.parse(r.eventos) as NotificationEventCode[],
  activo: r.activo,
});

const toTemplate = (r: TemplateRow): NotificationTemplate => ({
  id: r.id,
  codigo: r.codigo,
  canal: r.canal,
  cuerpo: r.cuerpo,
  activa: r.activa,
});

const toQueueItem = (r: QueueRow): NotificationQueueItem => ({
  id: r.id,
  codigo: r.codigo,
  canal: r.canal,
  destinatario: r.destinatario,
  destinatarioNombre: r.destinatarioNombre,
  mensaje: r.mensaje,
  estado: r.estado,
  intentos: r.intentos,
  ultimoError: r.ultimoError,
  creadoEn: r.creadoEn,
  enviadoEn: r.enviadoEn,
});

export class NotificationsRepo {
  constructor(private readonly db: Db) {}

  async insertRecipient(row: RecipientRow): Promise<NotificationRecipient> {
    await this.db.insert(schema.notificationsDestinatarios).values(row);
    return toRecipient(row);
  }

  async getRecipient(id: string): Promise<NotificationRecipient | null> {
    const row = await this.db.select().from(schema.notificationsDestinatarios).where(eq(schema.notificationsDestinatarios.id, id)).get();
    return row ? toRecipient(row) : null;
  }

  async updateRecipient(id: string, patch: Partial<RecipientRow>): Promise<NotificationRecipient> {
    await this.db.update(schema.notificationsDestinatarios).set(patch).where(eq(schema.notificationsDestinatarios.id, id));
    const updated = await this.getRecipient(id);
    if (!updated) throw new Error(`Destinatario ${id} no encontrado tras actualizar.`);
    return updated;
  }

  async listRecipients(): Promise<NotificationRecipient[]> {
    const rows = await this.db.select().from(schema.notificationsDestinatarios).all();
    return rows.map(toRecipient);
  }

  /** Destinatarios activos suscritos a un código de evento concreto. */
  async listRecipientsForEvent(codigo: NotificationEventCode): Promise<NotificationRecipient[]> {
    const rows = await this.db.select().from(schema.notificationsDestinatarios).where(eq(schema.notificationsDestinatarios.activo, true)).all();
    return rows.map(toRecipient).filter((r) => r.eventos.includes(codigo));
  }

  async insertTemplate(row: TemplateRow): Promise<NotificationTemplate> {
    await this.db.insert(schema.notificationsPlantillas).values(row);
    return toTemplate(row);
  }

  async listTemplates(): Promise<NotificationTemplate[]> {
    const rows = await this.db.select().from(schema.notificationsPlantillas).all();
    return rows.map(toTemplate);
  }

  async getTemplate(codigo: NotificationEventCode): Promise<NotificationTemplate | null> {
    const row = await this.db.select().from(schema.notificationsPlantillas).where(eq(schema.notificationsPlantillas.codigo, codigo)).get();
    return row ? toTemplate(row) : null;
  }

  async updateTemplate(codigo: NotificationEventCode, cuerpo: string): Promise<NotificationTemplate> {
    await this.db.update(schema.notificationsPlantillas).set({ cuerpo }).where(eq(schema.notificationsPlantillas.codigo, codigo));
    const updated = await this.getTemplate(codigo);
    if (!updated) throw new Error(`Plantilla "${codigo}" no encontrada tras actualizar.`);
    return updated;
  }

  async insertQueueItem(row: QueueRow): Promise<NotificationQueueItem> {
    await this.db.insert(schema.notificationsCola).values(row);
    return toQueueItem(row);
  }

  async getQueueItem(id: string): Promise<NotificationQueueItem | null> {
    const row = await this.db.select().from(schema.notificationsCola).where(eq(schema.notificationsCola.id, id)).get();
    return row ? toQueueItem(row) : null;
  }

  async updateQueueItem(id: string, patch: Partial<QueueRow>): Promise<NotificationQueueItem> {
    await this.db.update(schema.notificationsCola).set(patch).where(eq(schema.notificationsCola.id, id));
    const updated = await this.getQueueItem(id);
    if (!updated) throw new Error(`Notificación ${id} no encontrada tras actualizar.`);
    return updated;
  }

  async listQueue(estado?: NotificationState): Promise<NotificationQueueItem[]> {
    const rows = estado
      ? await this.db.select().from(schema.notificationsCola).where(eq(schema.notificationsCola.estado, estado)).all()
      : await this.db.select().from(schema.notificationsCola).all();
    return rows.map(toQueueItem).sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
  }

  async listPending(): Promise<NotificationQueueItem[]> {
    const rows = await this.db.select().from(schema.notificationsCola).where(eq(schema.notificationsCola.estado, "PENDIENTE")).all();
    return rows.map(toQueueItem);
  }
}
