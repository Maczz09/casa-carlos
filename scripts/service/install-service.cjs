// Registra Casa Carlos como servicio de Windows. Requiere administrador.
//
// node-windows envuelve `<execPath> [nodeOptions] <script>` — acá eso es el
// Node portátil (vendor/node-win-x64/node.exe) corriendo apps/server/src/index.ts
// TAL CUAL (sin build), vía `--import tsx` como loader — exactamente el mismo
// mecanismo que ya usa `pnpm run dev`/`start`, solo que ahora lo arranca
// Windows en vez de una terminal. Ver docs/ARQUITECTURA.md §3 y el plan de F6
// para la razón de por qué no se empaqueta en un solo .exe (@yao-pkg/pkg
// tiene un bug documentado con node:sqlite).
//
// Uso: node scripts/service/install-service.cjs   (como administrador)

const path = require("node:path");
const { Service } = require("node-windows");

const ROOT = path.resolve(__dirname, "../..");
const SERVER_DIR = path.join(ROOT, "apps/server");
const SCRIPT = path.join(SERVER_DIR, "src/index.ts");
const EXEC_PATH = path.join(ROOT, "vendor/node-win-x64/node.exe");

const svc = new Service({
  name: "CasaCarlos",
  description: "Casa Carlos — servidor de recepción, kiosco y facturación SUNAT.",
  script: SCRIPT,
  execPath: EXEC_PATH,
  nodeOptions: ["--import", "tsx"],
  // Tiene que ser apps/server, NO la raíz del repo: `--import tsx` resuelve
  // el specifier "tsx" como si el import viniera del cwd del proceso, y con
  // pnpm (node_modules aislado, no todo hoisteado a la raíz) `tsx` solo es
  // resoluble desde apps/server/node_modules — ahí es donde está declarado
  // como dependencia. Con cwd=ROOT esto falla con
  // "Cannot find package 'tsx' imported from <ROOT>" — confirmado en vivo
  // instalando el servicio (apps/server/src/daemon/casacarlos.err.log), no
  // es una suposición. `apps/server/src/index.ts` ya resuelve `.env`/`data/`
  // por la ubicación real del archivo (import.meta.url), no por cwd, así
  // que cambiar esto no rompe nada de eso.
  workingDirectory: SERVER_DIR,
  env: [{ name: "NODE_ENV", value: "production" }],
});

svc.on("install", () => {
  console.log("Servicio instalado. Arrancando...");
  svc.start();
});

svc.on("alreadyinstalled", () => {
  console.log("El servicio ya estaba instalado — no se hizo nada. Usa uninstall-service.cjs primero si querés reinstalarlo.");
});

svc.on("start", () => {
  console.log("Servicio 'CasaCarlos' corriendo. Verificá con: sc query CasaCarlos");
});

svc.on("error", (err) => {
  console.error("Error instalando/arrancando el servicio:", err);
  process.exitCode = 1;
});

svc.install();
