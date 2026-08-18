import type { NotificationSender } from "./types.js";

/**
 * Adaptador por defecto: no envía nada real, solo deja constancia en consola.
 * Es lo que corre en desarrollo y en cualquier instalación que no haya
 * habilitado `CASACARLOS_WHATSAPP=1` — nunca bloquea el arranque esperando un
 * WhatsApp conectado.
 */
export class ConsoleSender implements NotificationSender {
  async send(telefono: string, mensaje: string): Promise<void> {
    console.log(`[notifications] (simulado, WhatsApp no conectado) mensaje para ${telefono}:\n${mensaje}`);
  }
}
