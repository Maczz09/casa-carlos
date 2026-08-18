// Desinstala el servicio de Windows de Casa Carlos. Requiere administrador.
// Solo borra el registro del servicio — nunca toca data/ (base de datos ni
// respaldos). Uso: node scripts/service/uninstall-service.cjs (como administrador)

const path = require("node:path");
const { Service } = require("node-windows");

const ROOT = path.resolve(__dirname, "../..");

const svc = new Service({
  name: "CasaCarlos",
  script: path.join(ROOT, "apps/server/src/index.ts"),
});

svc.on("uninstall", () => {
  console.log("Servicio desinstalado. El servicio existe todavía:", svc.exists);
});

svc.on("alreadyuninstalled", () => {
  console.log("El servicio no estaba instalado — no había nada que hacer.");
});

svc.on("error", (err) => {
  console.error("Error desinstalando el servicio:", err);
  process.exitCode = 1;
});

svc.uninstall();
