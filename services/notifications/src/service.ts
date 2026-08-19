import { cents, format } from "@casacarlos/money";
import { newId } from "@casacarlos/contracts";
import type {
  CreateRecipientInput,
  DomainEvents,
  IdentityPort,
  NotificationEventCode,
  NotificationQueueItem,
  NotificationRecipient,
  NotificationState,
  NotificationTemplate,
  NotificationsPort,
  RoomsPort,
  UpdateRecipientInput,
} from "@casacarlos/contracts";
import { renderTemplate } from "./domain/template.js";
import { NotificationsRepo } from "./repo.js";

/** Por encima de esto (en céntimos) una diferencia de cierre de caja amerita avisar — espeja CASHBOX_DIFFERENCE_THRESHOLD_CENTIMOS de @casacarlos/cashbox (no se importa esa dependencia solo por esta constante). */
const SHIFT_DIFFERENCE_THRESHOLD_CENTIMOS = 500;

export class NotificationsService implements NotificationsPort {
  constructor(
    private readonly repo: NotificationsRepo,
    private readonly rooms: RoomsPort,
    private readonly identity: IdentityPort,
  ) {}

  /** Garantiza que cada código de evento tenga su plantilla — se llama una vez al construir el servicio, nunca pisa una plantilla ya personalizada por el admin. */
  async ensureDefaultTemplates(): Promise<void> {
    const defaults: Record<NotificationEventCode, string> = {
      STAY_OVERSTAYED: "Aviso: el cuarto {{cuarto}} superó el tiempo de tolerancia por {{minutos}} minutos. Revisar en recepción.",
      LOW_STOCK: "Stock bajo: {{producto}} quedó en {{stock}} unidades (mínimo {{minimo}}).",
      SHIFT_DIFFERENCE: "Diferencia de caja: el turno cerrado por {{cajero}} presentó una diferencia de {{diferencia}}.",
    };
    for (const [codigo, cuerpo] of Object.entries(defaults) as [NotificationEventCode, string][]) {
      const existing = await this.repo.getTemplate(codigo);
      if (existing) continue;
      await this.repo.insertTemplate({ id: newId(), codigo, canal: "WHATSAPP", cuerpo, activa: true });
    }
  }

  async listRecipients(): Promise<NotificationRecipient[]> {
    return this.repo.listRecipients();
  }

  async createRecipient(input: CreateRecipientInput): Promise<NotificationRecipient> {
    return this.repo.insertRecipient({
      id: newId(),
      usuarioId: input.usuarioId ?? null,
      nombre: input.nombre,
      telefono: input.telefono,
      eventos: JSON.stringify(input.eventos),
      activo: true,
    });
  }

  async updateRecipient(id: string, patch: UpdateRecipientInput): Promise<NotificationRecipient> {
    const { eventos, ...rest } = patch;
    return this.repo.updateRecipient(id, {
      ...rest,
      ...(eventos ? { eventos: JSON.stringify(eventos) } : {}),
    });
  }

  async listTemplates(): Promise<NotificationTemplate[]> {
    return this.repo.listTemplates();
  }

  async updateTemplate(codigo: NotificationEventCode, cuerpo: string): Promise<NotificationTemplate> {
    return this.repo.updateTemplate(codigo, cuerpo);
  }

  async listQueue(estado?: NotificationState): Promise<NotificationQueueItem[]> {
    return this.repo.listQueue(estado);
  }

  /**
   * Reintento manual desde la pantalla de notificaciones. Vuelve a dejar el
   * mensaje PENDIENTE: quien envía de verdad es el agente de WhatsApp
   * (`apps/whatsapp-agent`), que lo va a tomar en su próxima pasada — el
   * servidor no puede enviar por su cuenta, ver `whatsapp-bridge.ts`.
   */
  async retry(id: string): Promise<NotificationQueueItem> {
    const item = await this.repo.getQueueItem(id);
    if (!item) throw new Error(`Notificación ${id} no encontrada.`);
    return this.repo.updateQueueItem(id, { estado: "PENDIENTE", ultimoError: null });
  }

  /** Cola que le toca enviar al agente de WhatsApp. */
  async listPending(): Promise<NotificationQueueItem[]> {
    return this.repo.listPending();
  }

  /** El agente confirma que un mensaje salió. */
  async markSent(id: string): Promise<void> {
    const item = await this.repo.getQueueItem(id);
    if (!item) return;
    await this.repo.updateQueueItem(id, {
      estado: "ENVIADO",
      enviadoEn: new Date().toISOString(),
      intentos: item.intentos + 1,
    });
  }

  /** El agente reporta que un mensaje falló — queda visible en la Cola con su motivo. */
  async markFailed(id: string, error: string): Promise<void> {
    const item = await this.repo.getQueueItem(id);
    if (!item) return;
    console.error(`[notifications] envío ${id} falló:`, error);
    await this.repo.updateQueueItem(id, {
      estado: "FALLIDO",
      ultimoError: error,
      intentos: item.intentos + 1,
    });
  }

  async handleStayOverstayed(payload: DomainEvents["stay.overstayed"]): Promise<void> {
    const room = await this.rooms.getRoom(payload.roomId);
    await this.enqueueForEvent("STAY_OVERSTAYED", {
      cuarto: room.numero,
      minutos: String(payload.minutesOver),
    });
  }

  async handleLowStock(payload: DomainEvents["inventory.low_stock"]): Promise<void> {
    await this.enqueueForEvent("LOW_STOCK", {
      producto: payload.nombre,
      stock: String(payload.stock),
      minimo: String(payload.stockMinimo),
    });
  }

  async handleShiftClosed(payload: DomainEvents["shift.closed"]): Promise<void> {
    if (Math.abs(payload.diferenciaCentimos) < SHIFT_DIFFERENCE_THRESHOLD_CENTIMOS) return;
    const user = await this.identity.getUser(payload.usuarioId);
    await this.enqueueForEvent("SHIFT_DIFFERENCE", {
      cajero: `${user.nombres} ${user.apellidos}`,
      diferencia: format(cents(payload.diferenciaCentimos)),
    });
  }

  private async enqueueForEvent(codigo: NotificationEventCode, vars: Record<string, string>): Promise<void> {
    const [template, recipients] = await Promise.all([this.repo.getTemplate(codigo), this.repo.listRecipientsForEvent(codigo)]);
    if (!template || !template.activa || recipients.length === 0) return;

    const now = new Date().toISOString();
    for (const recipient of recipients) {
      const mensaje = renderTemplate(template.cuerpo, vars);
      await this.repo.insertQueueItem({
        id: newId(),
        codigo,
        canal: template.canal,
        destinatario: recipient.telefono,
        destinatarioNombre: recipient.nombre,
        mensaje,
        estado: "PENDIENTE",
        intentos: 0,
        ultimoError: null,
        creadoEn: now,
        enviadoEn: null,
      });
    }
  }
}
