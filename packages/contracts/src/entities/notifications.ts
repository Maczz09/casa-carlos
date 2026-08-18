import { z } from "zod";

export const NotificationChannelSchema = z.enum(["WHATSAPP"]);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

/** Códigos de evento — cada uno tiene una plantilla propia. Ver REGLAS-DE-NEGOCIO.md §4 y ARQUITECTURA.md §7. */
export const NotificationEventCodeSchema = z.enum(["STAY_OVERSTAYED", "LOW_STOCK", "SHIFT_DIFFERENCE"]);
export type NotificationEventCode = z.infer<typeof NotificationEventCodeSchema>;

export const NotificationRecipientSchema = z.object({
  id: z.string(),
  usuarioId: z.string().nullable(),
  nombre: z.string(),
  telefono: z.string(),
  eventos: z.array(NotificationEventCodeSchema),
  activo: z.boolean(),
});
export type NotificationRecipient = z.infer<typeof NotificationRecipientSchema>;

export const NotificationTemplateSchema = z.object({
  id: z.string(),
  codigo: NotificationEventCodeSchema,
  canal: NotificationChannelSchema,
  /** Texto con variables `{{como_esta}}` — ver la lista de variables por evento en el servicio. */
  cuerpo: z.string(),
  activa: z.boolean(),
});
export type NotificationTemplate = z.infer<typeof NotificationTemplateSchema>;

export const NotificationStateSchema = z.enum(["PENDIENTE", "ENVIADO", "FALLIDO"]);
export type NotificationState = z.infer<typeof NotificationStateSchema>;

export const NotificationQueueItemSchema = z.object({
  id: z.string(),
  codigo: NotificationEventCodeSchema,
  canal: NotificationChannelSchema,
  destinatario: z.string(),
  destinatarioNombre: z.string(),
  mensaje: z.string(),
  estado: NotificationStateSchema,
  intentos: z.number().int().nonnegative(),
  ultimoError: z.string().nullable(),
  creadoEn: z.string(),
  enviadoEn: z.string().nullable(),
});
export type NotificationQueueItem = z.infer<typeof NotificationQueueItemSchema>;
