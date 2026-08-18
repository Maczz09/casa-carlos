import type { NotificationEventCode, NotificationQueueItem, NotificationRecipient, NotificationState, NotificationTemplate } from "../entities/notifications.js";

export interface CreateRecipientInput {
  usuarioId?: string | null;
  nombre: string;
  telefono: string;
  eventos: NotificationEventCode[];
}

export interface UpdateRecipientInput {
  nombre?: string;
  telefono?: string;
  eventos?: NotificationEventCode[];
  activo?: boolean;
}

/**
 * Public surface of `notifications`. Never called to "send" something
 * directly — it reacts to `stay.overstayed`, `inventory.low_stock` and
 * `shift.closed` on the bus and queues from there. The only writes exposed
 * here are configuration (recipients, templates) and retrying a failed send.
 */
export interface NotificationsPort {
  listRecipients(): Promise<NotificationRecipient[]>;
  createRecipient(input: CreateRecipientInput): Promise<NotificationRecipient>;
  updateRecipient(id: string, patch: UpdateRecipientInput): Promise<NotificationRecipient>;

  listTemplates(): Promise<NotificationTemplate[]>;
  updateTemplate(codigo: NotificationEventCode, cuerpo: string): Promise<NotificationTemplate>;

  listQueue(estado?: NotificationState): Promise<NotificationQueueItem[]>;
  retry(id: string): Promise<NotificationQueueItem>;
}
