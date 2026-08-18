import type { NotificationSender } from "./types.js";

interface WhatsAppClient {
  on(event: "qr", listener: (qr: string) => void): void;
  on(event: "ready", listener: () => void): void;
  on(event: "auth_failure", listener: (message: string) => void): void;
  on(event: "disconnected", listener: (reason: string) => void): void;
  initialize(): Promise<void>;
  sendMessage(chatId: string, message: string): Promise<unknown>;
}

interface WhatsAppWebModule {
  Client: new (options: { authStrategy: unknown }) => WhatsAppClient;
  LocalAuth: new (options: { dataPath: string }) => unknown;
}

const WHATSAPP_WEB_JS = "whatsapp-web.js";
const QRCODE_TERMINAL = "qrcode-terminal";

/**
 * Envía por WhatsApp real automatizando el WhatsApp Web del teléfono del
 * hotel vía `whatsapp-web.js` — gratis, sin costo de WhatsApp Business API
 * (decisión del cliente, ver conversación de alcance). El paquete NO figura
 * en package.json: se importa de forma perezosa con un especificador
 * dinámico para que ni `pnpm install` ni el typecheck del monorepo requieran
 * que esté presente. Para habilitarlo de verdad:
 *
 *   1. pnpm add whatsapp-web.js qrcode-terminal --filter @casacarlos/notifications
 *   2. Arrancar el servidor con la variable de entorno CASACARLOS_WHATSAPP=1
 *   3. Escanear el código QR que imprime la consola con el WhatsApp del hotel
 *      (WhatsApp → Dispositivos vinculados). La sesión queda guardada en
 *      `sessionDir`, así que solo hace falta escanear una vez por instalación.
 */
export class WhatsAppSender implements NotificationSender {
  private ready: Promise<WhatsAppClient> | null = null;

  constructor(private readonly sessionDir: string) {}

  private client(): Promise<WhatsAppClient> {
    if (!this.ready) this.ready = this.init();
    return this.ready;
  }

  private async init(): Promise<WhatsAppClient> {
    let mod: WhatsAppWebModule;
    try {
      mod = (await import(WHATSAPP_WEB_JS)) as WhatsAppWebModule;
    } catch {
      throw new Error(
        `CASACARLOS_WHATSAPP=1 pero "${WHATSAPP_WEB_JS}" no está instalado. Ejecuta: pnpm add whatsapp-web.js qrcode-terminal --filter @casacarlos/notifications`,
      );
    }
    const { Client, LocalAuth } = mod;
    const client = new Client({ authStrategy: new LocalAuth({ dataPath: this.sessionDir }) });

    client.on("qr", async (qr) => {
      try {
        const qrcode = (await import(QRCODE_TERMINAL)) as { default: { generate(text: string, opts: { small: boolean }): void } };
        qrcode.default.generate(qr, { small: true });
      } catch {
        console.log(`[notifications] Código QR de WhatsApp:\n${qr}`);
      }
      console.log("[notifications] Escanea el código con WhatsApp → Dispositivos vinculados (solo la primera vez).");
    });
    client.on("ready", () => console.log("[notifications] WhatsApp conectado."));
    client.on("auth_failure", (msg) => console.error(`[notifications] Fallo de autenticación de WhatsApp: ${msg}`));
    client.on("disconnected", (reason) => console.warn(`[notifications] WhatsApp desconectado: ${reason}`));

    await client.initialize();
    return client;
  }

  async send(telefono: string, mensaje: string): Promise<void> {
    const client = await this.client();
    const numero = telefono.replace(/\D/g, "");
    await client.sendMessage(`${numero}@c.us`, mensaje);
  }
}
