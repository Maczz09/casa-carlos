import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
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
import { brandRoutes } from "./routes/brand.js";
import { ImageStorage, MAX_IMAGE_BYTES } from "./image-storage.js";
import { BrandStore } from "./brand-store.js";
import { SunatConfigStore, endpointPara, type SunatSecretConfig } from "./sunat-config.js";
import type { SunatMode } from "@casacarlos/contracts";
import { sunatRoutes } from "./routes/sunat.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Un solo .env compartido en la raíz del repo (ver .gitignore) — evita tener que exportar
// variables a mano cada vez que se arranca el servidor (ej. la config SUNAT_MODE=BETA).
const envPath = resolve(__dirname, "../../../.env");
if (existsSync(envPath)) process.loadEnvFile(envPath);

const PORT = Number(process.env.PORT ?? 4000);

/**
 * Arma el cliente de SUNAT para una configuración dada.
 *
 * MOCK no toca la red ni pide certificado — para desarrollo y demo. BETA usa
 * el ambiente de pruebas real de SUNAT (acepta cualquier certificado, incluso
 * uno autofirmado). PRODUCCION exige el certificado digital del hotel y las
 * credenciales SOL secundarias — ver docs/ARQUITECTURA.md.
 *
 * La configuración se puede cambiar en caliente desde Ajustes → SUNAT
 * (apps/server/src/sunat-config.ts); por eso esto es una función pura sobre
 * una config y no lee `process.env` por su cuenta.
 */
function buildSunatRuntime(config: SunatSecretConfig): { modo: SunatMode; emisor: EmisorInfo; sunatClient: SunatClient; cert: CertificateMaterial | null } {
  const emisor: EmisorInfo = config.emisor;

  if (config.modo === "MOCK") {
    return { modo: "MOCK", emisor, sunatClient: new MockSunatClient(), cert: null };
  }

  const endpoint = endpointPara(config.modo);
  if (!endpoint) throw new Error(`Modo de facturación "${config.modo}" inválido — usa MOCK, BETA o PRODUCCION.`);
  if (!config.solUser || !config.solPassword || !config.certPath || !config.certPassword) {
    throw new Error(
      `El modo ${config.modo} necesita usuario SOL, clave SOL y el certificado digital con su contraseña. Cargalos en Ajustes → SUNAT.`,
    );
  }

  const sunatClient = new RealSunatClient({ endpoint, ruc: emisor.ruc, solUser: config.solUser, solPassword: config.solPassword });
  let cert: CertificateMaterial;
  try {
    cert = loadPfxCertificate(config.certPath, config.certPassword);
  } catch (err) {
    // El error crudo de node-forge no le dice nada a quien está en el
    // mostrador; lo que necesita saber es qué hacer al respecto.
    throw new Error(`No se pudo usar el certificado digital guardado (${(err as Error).message}). Cargalo de nuevo en Ajustes → SUNAT junto con su contraseña.`);
  }
  return { modo: config.modo, emisor, sunatClient, cert };
}

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
  const productImages = new ImageStorage(dataDir, "product-images");
  const qrImages = new ImageStorage(dataDir, "qr-images");
  const brand = new BrandStore(dataDir);
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
  const sunatConfig = new SunatConfigStore(envPath, dataDir);
  await ensureBillingCorrelativosSeeded(db);
  // Si la configuración guardada no sirve (certificado movido, clave mal
  // cargada en la instalación), el servidor NO puede negarse a arrancar: sin
  // servidor tampoco hay pantalla donde corregirla. Cae a MOCK avisando, y el
  // administrador la arregla desde Ajustes → SUNAT.
  let runtime: ReturnType<typeof buildSunatRuntime>;
  try {
    runtime = buildSunatRuntime(sunatConfig.current());
  } catch (err) {
    console.warn(`\n[SUNAT] ${(err as Error).message}`);
    console.warn("[SUNAT] Arrancando en modo MOCK: los comprobantes NO se envían. Corregilo en Ajustes → SUNAT.\n");
    runtime = buildSunatRuntime({ ...sunatConfig.current(), modo: "MOCK" });
  }
  const billing = createBillingService(db, sales, runtime.sunatClient, runtime.emisor, runtime.cert);
  const kiosk = new KioskStore(rooms, pricing, stays, sales, inventory, bus);

  await seedIfEmpty(rooms, pricing, identity, payments, inventory, cashbox);

  const scheduler = startScheduler(rooms, stays);
  const backupJob = startBackupJob(sqlite, dataDir);

  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });
  await app.register(websocketPlugin);

  const services: Services = {
    identity,
    rooms,
    pricing,
    stays,
    sales,
    payments,
    kiosk,
    inventory,
    productImages,
    qrImages,
    brand,
    cashbox,
    reporting,
    notifications,
    billing,
    sunatConfig,
    sunatModoActivo: runtime.modo,
    // Rehace el servicio de facturación con la configuración recién guardada.
    // Los manejadores de rutas leen `services.billing` en cada request, así
    // que reemplazarlo acá alcanza para que el cambio aplique al toque, sin
    // reiniciar el servicio de Windows.
    applySunatConfig: (config: SunatSecretConfig) => {
      const nuevo = buildSunatRuntime(config);
      services.billing = createBillingService(db, sales, nuevo.sunatClient, nuevo.emisor, nuevo.cert);
      services.sunatModoActivo = nuevo.modo;
    },
    whatsapp,
    agentToken,
  };
  registerAuth(app);
  await app.register(fastifyMultipart, {
    // `fields: 2` por la carga del certificado SUNAT, que viaja con su
    // contraseña en el mismo formulario. Las subidas de imágenes no mandan
    // campos y no se ven afectadas.
    limits: { files: 1, fileSize: MAX_IMAGE_BYTES, fields: 2 },
  });
  registerWebSocketGateway(app, bus, rooms, identity, kiosk, inventory);

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
  await app.register(brandRoutes(services));
  await app.register(sunatRoutes(services));

  // Sirve las 2 SPA ya compiladas (`pnpm -r run build`) desde este mismo proceso —
  // en producción reemplaza los 3 procesos de desarrollo (server + 2 dev server de Vite)
  // por uno solo. Condicionado a que el `dist/` exista: en desarrollo normal (`pnpm run dev`)
  // nadie compila los frontends, así que esto se salta sin más y el flujo de 3 procesos
  // sigue funcionando igual que siempre.
  const receptionDist = resolve(__dirname, "../../web-reception/dist");
  const kioskDist = resolve(__dirname, "../../web-kiosk/dist");
  await app.register(fastifyStatic, {
    root: productImages.root,
    prefix: "/product-images/",
    maxAge: "7d",
  });
  await app.register(fastifyStatic, {
    root: qrImages.root,
    prefix: "/qr-images/",
    maxAge: "7d",
    decorateReply: false,
  });
  // El logo cambia poco pero cuando cambia tiene que verse ya: sin caché larga,
  // a diferencia de las fotos de producto y los QR, que tienen nombre opaco
  // distinto en cada carga.
  await app.register(fastifyStatic, {
    root: brand.root,
    prefix: "/brand-images/",
    maxAge: 0,
    decorateReply: false,
  });
  if (existsSync(receptionDist)) {
    await app.register(fastifyStatic, { root: receptionDist, prefix: "/", decorateReply: false });
  }
  if (existsSync(kioskDist)) {
    await app.register(fastifyStatic, { root: kioskDist, prefix: "/kiosk/", decorateReply: false });
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
  productImages: ImageStorage;
  qrImages: ImageStorage;
  brand: BrandStore;
  sunatConfig: SunatConfigStore;
  /** Modo con el que está funcionando la facturación ahora mismo — ver `SunatConfig.modoActivo`. */
  sunatModoActivo: SunatMode;
  /** Vuelve a construir `billing` con una configuración nueva. Lanza si esa configuración no sirve. */
  applySunatConfig: (config: SunatSecretConfig) => void;
  cashbox: ReturnType<typeof createCashboxService>;
  reporting: ReturnType<typeof createReportingService>;
  notifications: Awaited<ReturnType<typeof createNotificationsService>>;
  billing: ReturnType<typeof createBillingService>;
  whatsapp: WhatsAppBridge;
  /** Secreto compartido con apps/whatsapp-agent — ver ensureAgentToken. */
  agentToken: string;
};
