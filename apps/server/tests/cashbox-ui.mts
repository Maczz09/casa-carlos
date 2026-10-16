// Servidor y base en memoria: verifica la UI compilada y WebSockets reales,
// sin abrir el servidor ni la base de datos de producción del hotel.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { chromium } from "@playwright/test";
import { openDatabase, runMigrations, afterCommit } from "@casacarlos/db";
import { InProcessBus } from "@casacarlos/bus";
import { createCashboxService } from "@casacarlos/cashbox";
import { cashboxRoutes } from "../src/routes/cashbox.js";
import { registerWebSocketGateway } from "../src/ws.js";
import { floors, product, user, otherUser, responseFor } from "../../../scripts/ui-smoke-fixtures.mjs";

const root = path.resolve(import.meta.dirname, "../../..");
const out = path.join(root, ".cache/cashbox-ui"); fs.mkdirSync(out, { recursive: true });
const before = process.argv.includes("--before");
const { db, sqlite } = openDatabase(":memory:"); await runMigrations(db, sqlite);
const bus = new InProcessBus(notify => afterCommit(db, notify));
let now = new Date("2026-10-14T16:59:00-05:00");
const cashbox = createCashboxService(db, bus, {} as any, () => now);
await cashbox.applyStandardSchedule("Ana");
await cashbox.openShift({ usuarioId: user.id, aperturaCentimos: 10000 });
const identity: any = { getUserByToken: async (token: string) => token === "Luis" ? otherUser : user, getUser: async (id: string) => id === otherUser.id ? otherUser : user };
const app = Fastify(); await app.register(websocket);
await app.register(cashboxRoutes({ cashbox, identity, sunatConfig: { read: () => ({ emisor: { razonSocial: "Prueba" } }) } } as any));
registerWebSocketGateway(app, bus, { getBoard: async () => floors } as any, identity, { getCurrent: () => null, onChange: () => {}, onRemoteAction: () => {} } as any, { listProducts: async () => [product] } as any);
app.get("/api/me", async req => identity.getUserByToken(req.headers.authorization?.slice(7)));
app.post<{ Body: { usuario: string } }>("/api/auth/login", async req => ({ token: req.body.usuario === otherUser.usuario ? "Luis" : "Ana", user: req.body.usuario === otherUser.usuario ? otherUser : user }));
app.get("/api/*", async req => responseFor(new URL(req.url, "http://localhost")));
await app.register(fastifyStatic, { root: path.join(root, "apps/web-reception/dist") });
const base = await app.listen({ host: "127.0.0.1", port: 0 });
const browser = await chromium.launch({ executablePath: process.env.UI_BROWSER ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const results: any = { phase: before ? "before" : "after", buttons: [], synchronization: [], errors: [] };
const contexts: any[] = [];
async function session(token: string) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
  contexts.push(context);
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  await context.addInitScript(token => {
    localStorage.setItem("cc_token", token); localStorage.setItem("casacarlos.tour.v2", "done"); localStorage.setItem("casacarlos.theme_override", "light");
  }, token);
  const page = await context.newPage(); page.setDefaultTimeout(7000);
  page.on("pageerror", error => results.errors.push(error.message));
  await page.goto(`${base}/#/caja`);
  await page.getByRole("button", { name: "Cerrar turno", exact: true }).waitFor();
  return { context, page, token };
}
try {
  const a = await session("Ana");
  for (const [width, height] of [[1366, 768], [1024, 768], [390, 844]]) {
    await a.page.setViewportSize({ width, height });
    await a.page.getByRole("button", { name: "Cerrar turno", exact: true }).click();
    const dialog = a.page.getByRole("dialog", { name: "Cerrar caja con habitaciones abiertas" });
    await dialog.waitFor();
    const bounds = await dialog.locator("button").evaluateAll(buttons => buttons.map(button => {
      const rect = button.getBoundingClientRect(), row = button.parentElement!.getBoundingClientRect();
      return { text: button.textContent, left: rect.left, right: rect.right, containerLeft: row.left, containerRight: row.right, fits: rect.left >= row.left - 1 && rect.right <= row.right + 1 && button.scrollWidth <= button.clientWidth + 1 };
    }));
    results.buttons.push({ width, bounds });
    await a.page.screenshot({ path: path.join(out, `${before ? "before" : "after"}-${width}.png`), fullPage: true });
    if (!before) assert.ok(bounds.every(b => b.fits), `Botones dentro del diálogo a ${width}px`);
    await dialog.getByRole("button", { name: "Cancelar y revisar cuartos" }).click();
    await dialog.waitFor({ state: "hidden" });
  }
  if (!before) {
    await a.page.setViewportSize({ width: 1366, height: 768 });
    const b = await session("Luis");
    const current = (s: any) => s.context.request.get(`${base}/api/cashbox/shifts/current`, { headers: { authorization: `Bearer ${s.token}` } }).then((r: any) => r.json());
    const first = await current(a); assert.equal((await current(b)).id, first.id);
    const movement = await b.context.request.post(`${base}/api/cashbox/shifts/${first.id}/movements`, { headers: { authorization: "Bearer Luis" }, data: { tipo: "INGRESO", montoCentimos: 500, motivo: "Prueba sincronizada" } });
    assert.equal(movement.status(), 200);
    await a.page.getByText("S/ 105.00", { exact: true }).first().waitFor({ timeout: 5000 });
    await b.page.getByText("S/ 105.00", { exact: true }).first().waitFor({ timeout: 5000 });
    results.synchronization.push("Movimiento de Luis visible en ambas sesiones sin recargar");
    now = new Date("2026-10-14T17:00:00-05:00"); await cashbox.runTimers();
    await a.page.getByText("El fondo inicial se recibió del turno anterior por relevo automático.", { exact: false }).waitFor({ timeout: 5000 });
    await b.page.getByText("El fondo inicial se recibió del turno anterior por relevo automático.", { exact: false }).waitFor({ timeout: 5000 });
    const next = await current(a); assert.notEqual(next.id, first.id); assert.equal((await current(b)).id, next.id);
    results.synchronization.push("Relevo automático visible en ambas sesiones por WebSocket");
    await a.page.getByRole("button", { name: "Cerrar sesión" }).click();
    await a.page.getByRole("textbox", { name: "Usuario", exact: true }).fill(otherUser.usuario);
    await a.page.getByLabel("Contraseña", { exact: true }).fill("prueba-local");
    await a.page.getByRole("button", { name: "Ingresar", exact: true }).click();
    await a.page.getByRole("button", { name: "Cerrar turno", exact: true }).waitFor();
    assert.equal(await a.page.evaluate(() => localStorage.getItem("cc_token")), "Luis");
    const token = await a.page.evaluate(() => localStorage.getItem("cc_token"));
    const relogin = await a.context.request.get(`${base}/api/cashbox/shifts/current`, { headers: { authorization: `Bearer ${token}` } });
    assert.equal((await relogin.json()).id, next.id);
    results.synchronization.push("Cerrar sesión e ingresar como otro recepcionista conserva la caja activa");
    const closed = await b.context.request.post(`${base}/api/cashbox/shifts/${next.id}/close`, { headers: { authorization: "Bearer Luis" }, data: { denominaciones: { "10000": 1, "500": 1 } } });
    assert.equal(closed.status(), 200);
    for (const page of [a.page, b.page]) await page.getByText("La caja del hotel está cerrada", { exact: true }).waitFor({ timeout: 5000 });
    results.synchronization.push("Cierre de caja visible en ambas sesiones sin recargar");
    await b.page.getByRole("spinbutton", { name: "Fondo inicial en soles" }).fill("105");
    await b.page.getByRole("button", { name: "Abrir turno", exact: true }).click();
    for (const page of [a.page, b.page]) await page.getByRole("button", { name: "Cerrar turno", exact: true }).waitFor({ timeout: 5000 });
    results.synchronization.push("Nueva apertura compartida por ambas sesiones");
    assert.deepEqual(results.errors, []);
  }
  console.log(JSON.stringify(results, null, 2));
} finally {
  fs.writeFileSync(path.join(out, `${before ? "before" : "after"}-results.json`), JSON.stringify(results, null, 2));
  for (let i = 0; i < contexts.length; i++) await contexts[i].tracing.stop({ path: path.join(out, `${before ? "before" : "after"}-session-${i}.zip`) });
  await browser.close(); await app.close(); sqlite.close();
}
