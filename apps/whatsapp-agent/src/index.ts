import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Agente de WhatsApp de Hospedaje Carlos.
 *
 * Corre como proceso normal en la sesión de Windows del usuario (arranca solo
 * al iniciar sesión, ver el acceso directo de Inicio que crea el instalador),
 * NO dentro del servicio de Windows. Esa es toda la razón de que exista:
 * `whatsapp-web.js` automatiza un Chromium real, y Windows aísla los servicios
 * en la "Sesión 0", sin escritorio, donde Chromium no arranca — comprobado en
 * la instalación real con dos cuentas distintas y varios flags, siempre
 * "Failed to launch the browser process: Code: 1002". Ver
 * services/notifications/src/whatsapp-bridge.ts.
 *
 * No toca la base de datos ni sabe nada del negocio: habla solo con el
 * servidor por HTTP local, cada 2 segundos, contándole en qué anda y
 * llevándose los mensajes que haya para mandar.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const DATA_DIR = resolve(ROOT, "data");
const SESSION_DIR = resolve(DATA_DIR, "whatsapp-session");
const TOKEN_FILE = resolve(DATA_DIR, "whatsapp-agent.token");

const SERVER_URL = process.env.CASACARLOS_URL ?? "http://localhost:4000";
const SYNC_MS = 2000;
/** Cuando el servidor todavía no levantó, no tiene sentido machacarlo cada 2s. */
const RETRY_SERVIDOR_MS = 10_000;

type AgentStatus = "DESCONECTADO" | "ESPERANDO_QR" | "CONECTADO";

interface PendingMessage {
  id: string;
  telefono: string;
  mensaje: string;
}

interface SyncResponse {
  conectar: boolean;
  desconectar: boolean;
  pendientes: PendingMessage[];
}

interface SendResult {
  id: string;
  ok: boolean;
  error?: string;
}

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

/**
 * Se usa el Edge que Windows ya trae de fábrica (o Chrome si está): puppeteer
 * tiene desactivada la descarga de su propio Chromium (.puppeteerrc.cjs en la
 * raíz) para no bajar ~200MB en cada instalación del cliente.
 */
const CHROMIUM_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

function findChromium(): string | null {
  return CHROMIUM_CANDIDATES.find((p) => existsSync(p)) ?? null;
}

function leerToken(): string | null {
  try {
    const token = readFileSync(TOKEN_FILE, "utf8").trim();
    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

class Agente {
  private client: WhatsAppClient | null = null;
  private status: AgentStatus = "DESCONECTADO";
  private qr: string | null = null;
  private resultados: SendResult[] = [];
  private enviando = false;

  async conectar(): Promise<void> {
    if (this.client) return;

    const executablePath = findChromium();
    if (!executablePath) {
      console.error("[agente] No se encontró Microsoft Edge ni Google Chrome — hace falta uno de los dos.");
      return;
    }

    // whatsapp-web.js es CommonJS (`export =`): bajo ESM, Node expone algunos
    // named exports arriba (Client) pero no otros (LocalAuth solo en .default).
    const imported = (await import("whatsapp-web.js")) as { default?: WhatsAppWebModule } & WhatsAppWebModule;
    const { Client, LocalAuth } = imported.default ?? imported;

    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
      puppeteer: { executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] },
    });

    client.on("qr", (qr) => {
      this.qr = qr;
      this.status = "ESPERANDO_QR";
      console.log("[agente] QR generado — escanealo desde Notificaciones → WhatsApp.");
    });
    client.on("ready", () => {
      this.qr = null;
      this.status = "CONECTADO";
      console.log("[agente] WhatsApp conectado.");
    });
    client.on("auth_failure", (msg) => {
      console.error("[agente] Fallo de autenticación:", msg);
      void this.desconectar();
    });
    client.on("disconnected", (reason) => {
      console.warn("[agente] WhatsApp se desconectó:", reason);
      void this.desconectar();
    });

    this.client = client;
    this.status = "ESPERANDO_QR";
    // `initialize()` recién resuelve cuando WhatsApp queda listo (puede tardar
    // lo que tarde alguien en escanear), así que no se espera acá: el estado
    // viaja por los eventos de arriba.
    client.initialize().catch((err: unknown) => {
      console.error("[agente] Error inicializando WhatsApp:", err);
      this.client = null;
      this.status = "DESCONECTADO";
      this.qr = null;
    });
  }

  async desconectar(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.status = "DESCONECTADO";
    this.qr = null;
    if (client) await client.destroy().catch(() => {});
  }

  /** Manda lo que haya en cola. Secuencial y con candado: WhatsApp no quiere ráfagas en paralelo. */
  private async enviarPendientes(pendientes: PendingMessage[]): Promise<void> {
    if (this.enviando || this.status !== "CONECTADO" || !this.client) return;
    this.enviando = true;
    try {
      for (const msg of pendientes) {
        const numero = msg.telefono.replace(/\D/g, "");
        try {
          await this.client.sendMessage(`${numero}@c.us`, msg.mensaje);
          this.resultados.push({ id: msg.id, ok: true });
          console.log(`[agente] Enviado a ${msg.telefono}.`);
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          this.resultados.push({ id: msg.id, ok: false, error });
          console.error(`[agente] Falló el envío a ${msg.telefono}:`, error);
        }
      }
    } finally {
      this.enviando = false;
    }
  }

  /** Un ciclo: reportar estado + resultados, recibir órdenes y cola. Devuelve false si el servidor no responde. */
  async sincronizar(token: string): Promise<boolean> {
    // Se vacían acá: si el POST falla, se reintentan en la próxima pasada.
    const resultados = this.resultados;
    this.resultados = [];

    let data: SyncResponse;
    try {
      const res = await fetch(`${SERVER_URL}/api/notifications/whatsapp/agent/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Agent-Token": token },
        body: JSON.stringify({ status: this.status, qr: this.qr, resultados }),
      });
      if (!res.ok) {
        this.resultados.unshift(...resultados);
        if (res.status === 401) console.error("[agente] El servidor rechazó el token. ¿Se reinstaló el sistema? Reiniciá el agente.");
        return false;
      }
      data = (await res.json()) as SyncResponse;
    } catch {
      this.resultados.unshift(...resultados);
      return false;
    }

    if (data.desconectar) await this.desconectar();
    if (data.conectar) await this.conectar();
    if (data.pendientes.length > 0) void this.enviarPendientes(data.pendientes);
    return true;
  }
}

async function main(): Promise<void> {
  console.log("Agente de WhatsApp — Hospedaje Carlos");
  console.log(`Servidor: ${SERVER_URL}`);

  const agente = new Agente();
  let avisoSinServidor = false;

  for (;;) {
    const token = leerToken();
    if (!token) {
      if (!avisoSinServidor) {
        console.log("Esperando a que el servidor arranque por primera vez...");
        avisoSinServidor = true;
      }
      await new Promise((r) => setTimeout(r, RETRY_SERVIDOR_MS));
      continue;
    }

    const ok = await agente.sincronizar(token);
    if (!ok && !avisoSinServidor) {
      console.log("Sin contacto con el servidor — reintentando...");
      avisoSinServidor = true;
    }
    if (ok && avisoSinServidor) {
      console.log("Conectado al servidor.");
      avisoSinServidor = false;
    }
    await new Promise((r) => setTimeout(r, ok ? SYNC_MS : RETRY_SERVIDOR_MS));
  }
}

void main();
