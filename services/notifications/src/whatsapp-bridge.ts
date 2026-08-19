/**
 * Estado de WhatsApp del lado del servidor. **No abre ningún navegador.**
 *
 * Por qué existe: `whatsapp-web.js` maneja WhatsApp automatizando un Chromium
 * real, y Windows corre los servicios en la "Sesión 0" — un espacio aislado
 * sin escritorio, donde Chromium/Edge NO arranca. Comprobado en vivo contra la
 * instalación real: falla igual con la cuenta LocalSystem y con una cuenta
 * local dedicada, con y sin --no-sandbox, siempre con
 * "Failed to launch the browser process: Code: 1002". El mismo código, corrido
 * como proceso normal en la sesión del usuario, genera el QR sin problema.
 *
 * Por eso el navegador vive en un proceso aparte (`apps/whatsapp-agent`) que
 * arranca con la sesión de Windows, y este objeto es solo el punto de
 * encuentro entre ese agente y el resto del sistema: guarda lo último que
 * reportó el agente y las órdenes que el admin dejó pedidas desde la UI.
 */
export type WhatsAppStatus = "AGENTE_OFFLINE" | "DESCONECTADO" | "ESPERANDO_QR" | "CONECTADO";

/** Lo que el agente puede reportar (nunca reporta AGENTE_OFFLINE: eso lo deduce el servidor por silencio). */
export type WhatsAppAgentStatus = Exclude<WhatsAppStatus, "AGENTE_OFFLINE">;

/**
 * El agente sincroniza cada 2s; con 15s de gracia se tolera una pasada perdida
 * (reinicio del agente, PC ocupada) antes de declararlo caído en la UI.
 */
const AGENTE_TIMEOUT_MS = 15_000;

export interface WhatsAppAgentOrders {
  conectar: boolean;
  desconectar: boolean;
}

export class WhatsAppBridge {
  private agentStatus: WhatsAppAgentStatus = "DESCONECTADO";
  private qr: string | null = null;
  private ultimoLatido = 0;
  private ordenes: WhatsAppAgentOrders = { conectar: false, desconectar: false };

  getStatus(): WhatsAppStatus {
    if (Date.now() - this.ultimoLatido > AGENTE_TIMEOUT_MS) return "AGENTE_OFFLINE";
    return this.agentStatus;
  }

  /** El QR solo tiene sentido mientras se está esperando el escaneo — expira rápido del lado de WhatsApp. */
  getQr(): string | null {
    return this.getStatus() === "ESPERANDO_QR" ? this.qr : null;
  }

  agenteEnLinea(): boolean {
    return Date.now() - this.ultimoLatido <= AGENTE_TIMEOUT_MS;
  }

  requestConnect(): void {
    this.ordenes = { conectar: true, desconectar: false };
  }

  requestDisconnect(): void {
    this.ordenes = { conectar: false, desconectar: true };
  }

  /**
   * Punto único de contacto del agente: reporta en qué anda y se lleva las
   * órdenes pendientes. Las órdenes se consumen acá (no se repiten en la
   * siguiente pasada) para que apretar "Conectar" una vez no deje al agente
   * reiniciando la sesión en bucle.
   */
  sync(status: WhatsAppAgentStatus, qr: string | null): WhatsAppAgentOrders {
    this.agentStatus = status;
    this.qr = qr;
    this.ultimoLatido = Date.now();
    const ordenes = this.ordenes;
    this.ordenes = { conectar: false, desconectar: false };
    return ordenes;
  }
}
