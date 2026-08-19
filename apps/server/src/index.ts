import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { openDatabase, runMigrations } from "@casacarlos/db";
import { InProcessBus } from "@casacarlos/bus";
import type { RoomsPort, StaysPort } from "@casacarlos/contracts";
import { createIdentityService } from "@casacarlos/identity";
import { createRoomsService } from "@casacarlos/rooms";
import { createPricingService } from "@casacarlos/pricing";
import { createStaysService } from "@casacarlos/stays";
import { createSalesService } from "@casacarlos/sales";
import { createPaymentsService } from "@casacarlos/payments";
import { createInventoryService } from "@casacarlos/inventory";
import { createCashboxService } from "@casacarlos/cashbox";
import { createReportingService } from "@casacarlos/reporting";
import { WhatsAppBridge, createNotificationsService } from "@casacarlos/notifications";
import type { CertificateMaterial, EmisorInfo, SunatClient } from "@casacarlos/billing";
import { MockSunatClient, RealSunatClient, createBillingService, ensureBillingCorrelativosSeeded, loadPfxCertificate } from "@casacarlos/billing";
import { startScheduler } from "@casacarlos/scheduler";
import { startBackupJob } from "@casacarlos/backup";
import { seedIfEmpty } from "./seed.js";
import { registerAuth } from "./auth.js";
import { registerWebSocketGateway } from "./ws.js";
import { KioskStore } from "./kiosk/store.js";
import { authRoutes } from "./routes/auth.js";
import { roomsRoutes } from "./routes/rooms.js";
import { pricingRoutes } from "./routes/pricing.js";
import { staysRoutes } from "./routes/stays.js";
import { salesRoutes } from "./routes/sales.js";
import { paymentsRoutes } from "./routes/payments.js";
import { receptionRoutes } from "./routes/reception.js";
import { kioskPublicRoutes } from "./routes/kiosk-public.js";
import { kioskReceptionRoutes } from "./routes/kiosk-reception.js";
import { inventoryRoutes } from "./routes/inventory.js";
import { cashboxRoutes } from "./routes/cashbox.js";
import { reportingRoutes } from "./routes/reporting.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { billingRoutes } from "./routes/billing.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Un solo .env compartido en la raíz del repo (ver .gitignore) — evita tener que exportar
// variables a mano cada vez que se arranca el servidor (ej. la config SUNAT_MODE=BETA).
const envPath = resolve(__dirname, "../../../.env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const PORT = Number(process.env.PORT ?? 4000);

const SUNAT_BETA_ENDPOINT = "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService";
const SUNAT_PRODUCCION_ENDPOINT = "https://e-factura.sunat.gob.pe/ol-ti-itcpfegem/billService";

/**
 * SUNAT_MODE=MOCK (por defecto) no toca la red ni pide certificado — para
 * desarrollo y demo. BETA usa el entorno de pruebas real de SUNAT (acepta
 * cualquier certificado, incluso uno autofirmado — no valida la cadena de
 * confianza). PRODUCCION exige el certificado digital MYPE real del cliente
 * y las credenciales SOL secundarias — ver docs/ARQUITECTURA.md y el reporte
 * de la fase F5 para el detalle de cómo obtenerlas.
 */
function configureSunat(): { emisor: EmisorInfo; sunatClient: SunatClient; cert: CertificateMaterial | null } {
  const mode = (process.env.SUNAT_MODE ?? "MOCK").toUpperCase();

  const emisor: EmisorInfo = {
    ruc: process.env.SUNAT_RUC ?? "20000000000",
    razonSocial: process.env.SUNAT_RAZON_SOCIAL ?? "HOSPEDAJE CARLOS SAC",
    nombreComercial: process.env.SUNAT_NOMBRE_COMERCIAL ?? "HOSPEDAJE CARLOS",
    direccion: process.env.SUNAT_DIRECCION ?? "AV PRINCIPAL S/N",
    ubigeo: process.env.SUNAT_UBIGEO ?? "150101",
    distrito: process.env.SUNAT_DISTRITO ?? "LIMA",
    provincia: process.env.SUNAT_PROVINCIA ?? "LIMA",
    departamento: process.env.SUNAT_DEPARTAMENTO ?? "LIMA",
  };

  if (mode === "MOCK") {
    return { emisor, sunatClient: new MockSunatClient(), cert: null };
  }

  if (mode !== "BETA" && mode !== "PRODUCCION") {
    throw new Error(`SUNAT_MODE="${mode}" inválido — usa MOCK, BETA o PRODUCCION.`);
  }

  const solUser = process.env.SUNAT_SOL_USER;
  const solPassword = process.env.SUNAT_SOL_PASSWORD;
  const certPath = process.env.SUNAT_CERT_PATH;
  const certPassword = process.env.SUNAT_CERT_PASSWORD;
  if (!solUser || !solPassword || !certPath || !certPassword) {
    throw new Error(
      `SUNAT_MODE=${mode} requiere SUNAT_SOL_USER, SUNAT_SOL_PASSWORD, SUNAT_CERT_PATH y SUNAT_CERT_PASSWORD en el entorno.`,
    );
  }

  const endpoint = mode === "PRODUCCION" ? SUNAT_PRODUCCION_ENDPOINT : SUNAT_BETA_ENDPOINT;
  const sunatClient = new RealSunatClient({ endpoint, ruc: emisor.ruc, solUser, solPassword });
  const cert = loadPfxCertificate(certPath, certPassword);
  return { emisor, sunatClient, cert };
}

/**
 * Token compartido con el agente de WhatsApp (apps/whatsapp-agent), que corre
 * como proceso aparte en la sesión del usuario. Se genera solo la primera vez
 * y queda en `data/` — así no hace falta configurar nada a mano ni tocar el
 * .env en las instalaciones que ya existen, y sobrevive a las actualizaciones
 * igual que la base de datos. Es un secreto local (ambos procesos viven en la
 * misma PC), solo evita que algo más en la máquina hable con estos endpoints.
 */
function ensureAgentToken(dataDir: string): string {
  const tokenPath = resolve(dataDir, "whatsapp-agent.token");
  if (existsSync(tokenPath)) {
    const existing = readFileSync(tokenPath, "utf8").trim();
    if (existing.length > 0) return existing;
  }
  const token = randomBytes(32).toString("hex");
  writeFileSync(tokenPath, token, "utf8");
  return token;
}

async function main() {
  const dataDir = resolve(__dirname, "../../../data");
  mkdirSync(dataDir, { recursive: true });
  const { db, sqlite } = openDatabase(resolve(dataDir, "casacarlos.db"));
  await runMigrations(db, sqlite);

  const bus = new InProcessBus();

  // `rooms` reads `stays` to compute the status it shows; `stays` reads `rooms` to validate
  // availability. Neither service imports the other's package — this closure breaks the
  // construction-order cycle without a package-level import cycle. See services/rooms/src/service.ts.
  let staysPortRef: StaysPort;
  const rooms: RoomsPort = createRoomsService(db, bus, () => staysPortRef);

  const identity = createIdentityService(db);
  const pricing = createPricingService(db);
  const stays = createStaysService(db, bus, rooms, pricing);
  staysPortRef = stays;
  const inventory = createInventoryService(db, bus);
  const sales = createSalesService(db, bus, rooms, pricing, stays, inventory);
  const payments = createPaymentsService(db, bus, sales);
  const cashbox = createCashboxService(db, bus, payments);
  const reporting = createReportingService(db);
  // El servidor NO abre WhatsApp: como corre dentro de un servicio de Windows
  // (Sesión 0, sin escritorio) Chromium no puede arrancar acá. De eso se
  // encarga apps/whatsapp-agent, un proceso aparte que arranca con la sesión
  // del usuario; este objeto es solo el punto de encuentro entre los dos.
  // Ver services/notifications/src/whatsapp-bridge.ts.
  const whatsapp = new WhatsAppBridge();
  const agentToken = ensureAgentToken(dataDir);
  const notifications = await createNotificationsService(db, bus, rooms, identity);
  const { emisor, sunatClient, cert } = configureSunat();
  await ensureBillingCorrelativosSeeded(db);
  const billing = createBillingService(db, sales, sunatClient, emisor, cert);
  const kiosk = new KioskStore(rooms, pricing, stays, sales, inventory, bus);

  await seedIfEmpty(rooms, pricing, identity, payments, inventory, cashbox);

  const scheduler = startScheduler(rooms, stays);
  const backupJob = startBackupJob(sqlite, dataDir);

  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });
  await app.register(websocketPlugin);

  const services = { identity, rooms, pricing, stays, sales, payments, kiosk, inventory, cashbox, reporting, notifications, billing, whatsapp, agentToken };
  registerAuth(app);
  registerWebSocketGateway(app, bus, rooms, identity, kiosk);

  await app.register(authRoutes(services));
  await app.register(roomsRoutes(services));
  await app.register(pricingRoutes(services));
  await app.register(staysRoutes(services));
  await app.register(salesRoutes(services));
  await app.register(paymentsRoutes(services));
  await app.register(receptionRoutes(services));
  await app.register(kioskPublicRoutes(services));
  await app.register(kioskReceptionRoutes(services));
  await app.register(inventoryRoutes(services));
  await app.register(cashboxRoutes(services));
  await app.register(reportingRoutes(services));
  await app.register(notificationsRoutes(services));
  await app.register(billingRoutes(services));

  // Sirve las 2 SPA ya compiladas (`pnpm -r run build`) desde este mismo proceso —
  // en producción reemplaza los 3 procesos de desarrollo (server + 2 dev server de Vite)
  // por uno solo. Condicionado a que el `dist/` exista: en desarrollo normal (`pnpm run dev`)
  // nadie compila los frontends, así que esto se salta sin más y el flujo de 3 procesos
  // sigue funcionando igual que siempre.
  const receptionDist = resolve(__dirname, "../../web-reception/dist");
  const kioskDist = resolve(__dirname, "../../web-kiosk/dist");
  if (existsSync(receptionDist)) {
    await app.register(fastifyStatic, { root: receptionDist, prefix: "/" });
  }
  if (existsSync(kioskDist)) {
    await app.register(fastifyStatic, { root: kioskDist, prefix: "/kiosk/", decorateReply: !existsSync(receptionDist) });
  }

  app.get("/api/health", async () => ({ ok: true, time: new Date().toISOString() }));

  const shutdown = async () => {
    scheduler.stop();
    backupJob.stop();
    await app.close();
    sqlite.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`\nHospedaje Carlos — servidor listo en http://localhost:${PORT}`);
  console.log(`Usuarios de prueba: admin/admin123 (PIN 0000) · recepcion/recepcion123 (PIN 1234)\n`);
}

main().catch((err) => {
  console.error("Fallo al iniciar el servidor:", err);
  process.exit(1);
});

export type Services = {
  identity: ReturnType<typeof createIdentityService>;
  rooms: RoomsPort;
  pricing: ReturnType<typeof createPricingService>;
  stays: StaysPort;
  sales: ReturnType<typeof createSalesService>;
  payments: ReturnType<typeof createPaymentsService>;
  kiosk: KioskStore;
  inventory: ReturnType<typeof createInventoryService>;
  cashbox: ReturnType<typeof createCashboxService>;
  reporting: ReturnType<typeof createReportingService>;
  notifications: Awaited<ReturnType<typeof createNotificationsService>>;
  billing: ReturnType<typeof createBillingService>;
  whatsapp: WhatsAppBridge;
  /** Secreto compartido con apps/whatsapp-agent — ver ensureAgentToken. */
  agentToken: string;
};
