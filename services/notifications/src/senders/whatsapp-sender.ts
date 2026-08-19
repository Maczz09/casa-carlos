import { existsSync } from "node:fs";
import type { NotificationSender } from "./types.js";

export type WhatsAppStatus = "DESCONECTADO" | "ESPERANDO_QR" | "CONECTADO";

interface WhatsAppClient {
  on(event: "qr", listener: (qr: string) => void): void;
  on(event: "ready", listener: () => void): void;
  on(event: "auth_failure", listener: (message: string) => void): void;
  on(event: "disconnected", listener: (reason: string) => void): void;
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  sendMessage(chatId: string, message: string): Promise<unknown>;
}

interface WhatsAppWebModule {
  Client: new (options: {
    authStrategy: unknown;
    puppeteer: { executablePath: string; headless: boolean; args?: string[] };
  }) => WhatsAppClient;
  LocalAuth: new (options: { dataPath: string }) => unknown;
}

const WHATSAPP_WEB_JS = "whatsapp-web.js";

/**
 * whatsapp-web.js trae puppeteer, que por defecto descarga su propio Chromium
 * (~200MB) en el postinstall — ver .puppeteerrc.cjs en la raíz del repo, que
 * desactiva esa descarga en cualquier máquina. En su lugar, se apunta al Edge
 * que Windows ya trae de fábrica desde 2020: cero descarga extra, funciona en
 * cualquier instalación limpia del cliente sin depender de que su red deje
 * pasar la descarga de Chromium.
 */
const CHROMIUM_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function findChromiumExecutable(): string | null {
  return CHROMIUM_CANDIDATES.find((p) => existsSync(p)) ?? null;
}

/**
 * Envía por WhatsApp real automatizando el WhatsApp Web del teléfono del
 * hotel vía `whatsapp-web.js` — gratis, sin costo de WhatsApp Business API
 * (decisión del cliente, ver conversación de alcance).
 *
 * A diferencia de la versión anterior, ya NO depende de una variable de
 * entorno ni de reiniciar el servidor: se conecta bajo demanda cuando el
 * admin lo pide desde Notificaciones → WhatsApp (`connect()`), el código QR
 * se expone como dato (`getQr()`) para que el frontend lo dibuje como imagen
 * en vez de imprimirlo en la consola del servidor, y la sesión queda guardada
 * en `sessionDir` — solo hace falta escanear una vez por instalación, y esa
 * carpeta vive en `data/`, que sobrevive a cualquier actualización del
 * sistema (ver installer/casacarlos.iss).
 */
export class WhatsAppSender implements NotificationSender {
  private client: WhatsAppClient | null = null;
  private status: WhatsAppStatus = "DESCONECTADO";
  private qr: string | null = null;

  constructor(private readonly sessionDir: string) {}

  getStatus(): WhatsAppStatus {
    return this.status;
  }

  getQr(): string | null {
    return this.qr;
  }

  /**
   * Idempotente: si ya está conectado o esperando que escaneen el QR, no
   * hace nada. No espera a que `initialize()` resuelva -- eso recién pasa
   * cuando WhatsApp queda listo (`ready`), que puede tardar hasta que alguien
   * escanee el código, y esto se llama desde una ruta HTTP que tiene que
   * responder al toque. El estado se sigue por el evento 'qr'/'ready', que el
   * frontend lee sondeando `getStatus()`/`getQr()`.
   */
  async connect(): Promise<void> {
    if (this.client) return;

    let mod: WhatsAppWebModule;
    try {
      // whatsapp-web.js es un paquete CommonJS (`export =`) -- bajo ESM, el
      // interop de Node expone ALGUNOS named exports en el objeto de arriba
      // (p.ej. Client) pero no otros (LocalAuth no), según cómo estén
      // asignados en su module.exports. `.default` siempre trae el objeto
      // completo tal cual lo exporta CJS, así que es la fuente confiable.
      // Confirmado a mano: `mod.LocalAuth` es undefined, `mod.default.LocalAuth` no.
      const imported = (await import(WHATSAPP_WEB_JS)) as { default?: WhatsAppWebModule } & WhatsAppWebModule;
      mod = imported.default ?? imported;
    } catch {
      throw new Error(`"${WHATSAPP_WEB_JS}" no está instalado. Ejecutá: pnpm add whatsapp-web.js --filter @casacarlos/notifications`);
    }

    const executablePath = findChromiumExecutable();
    if (!executablePath) {
      throw new Error("No se encontró Microsoft Edge ni Google Chrome instalados en esta PC -- hace falta uno de los dos para conectar WhatsApp.");
    }

    const { Client, LocalAuth } = mod;
    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: this.sessionDir }),
      // "--no-sandbox" es obligatorio acá: este proceso corre dentro del
      // servicio de Windows (cuenta LocalSystem, sesión 0, sin escritorio
      // interactivo), y el sandbox de Chromium/Edge necesita ese contexto
      // para inicializarse -- sin el flag, el navegador muere al instante
      // con "Failed to launch the browser process: Code: 1002". Confirmado
      // en el log real del servicio en producción, no es preventivo.
      puppeteer: { executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] },
    });

    client.on("qr", (qr) => {
      this.qr = qr;
      this.status = "ESPERANDO_QR";
    });
    client.on("ready", () => {
      this.qr = null;
      this.status = "CONECTADO";
      console.log("[notifications] WhatsApp conectado.");
    });
    client.on("auth_failure", (msg) => {
      console.error(`[notifications] Fallo de autenticación de WhatsApp: ${msg}`);
      this.status = "DESCONECTADO";
      this.qr = null;
      this.client = null;
    });
    client.on("disconnected", (reason) => {
      console.warn(`[notifications] WhatsApp desconectado: ${reason}`);
      this.status = "DESCONECTADO";
      this.qr = null;
      this.client = null;
    });

    this.client = client;
    // Se pone en ESPERANDO_QR ya mismo, no recién cuando llegue el evento —
    // si no, hay una ventana (mientras arranca puppeteer) donde el estado
    // sigue viéndose "DESCONECTADO" a pesar de que ya se apretó "Conectar".
    this.status = "ESPERANDO_QR";

    client.initialize().catch((err: unknown) => {
      console.error("[notifications] Error inicializando WhatsApp:", err);
      this.status = "DESCONECTADO";
      this.client = null;
    });
  }

  /** Cierra la sesión actual -- para vincular un WhatsApp distinto. */
  async disconnect(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.status = "DESCONECTADO";
    this.qr = null;
    if (client) await client.destroy().catch(() => {});
  }

  async send(telefono: string, mensaje: string): Promise<void> {
    if (this.status !== "CONECTADO" || !this.client) {
      throw new Error("WhatsApp no está vinculado todavía — andá a Notificaciones → WhatsApp para conectarlo.");
    }
    const numero = telefono.replace(/\D/g, "");
    await this.client.sendMessage(`${numero}@c.us`, mensaje);
  }
}
