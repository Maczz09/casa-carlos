import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { openDatabase, runMigrations, afterCommit, schema, eq } from "@casacarlos/db";
import { InProcessBus } from "@casacarlos/bus";
import { createCashboxService } from "@casacarlos/cashbox";
import { createPaymentsService } from "@casacarlos/payments";
import { cashboxRoutes } from "../src/routes/cashbox.js";

async function fixture() {
  const { db, sqlite } = openDatabase(":memory:");
  await runMigrations(db, sqlite);
  const bus = new InProcessBus(notify => afterCommit(db, notify));
  let now = new Date("2026-10-14T16:59:00-05:00");
  const sales: any = { getSale: async () => ({ id: "sale", estado: "ABIERTA", saldoCentimos: 20000 }) };
  const payments = createPaymentsService(db, bus, sales);
  const cashbox = createCashboxService(db, bus, payments, () => now);
  const user = (id: string) => ({ id, nombres: id, apellidos: "", rol: "RECEPCIONISTA", permisos: id === "sin_permiso" ? [] : ["CASHBOX_MANAGE"] });
  const services: any = { cashbox, payments, sales, identity: { getUserByToken: async (id: string) => user(id), getUser: async (id: string) => user(id) }, sunatConfig: { read: () => ({ emisor: {} }) } };
  const app = Fastify(); await app.register(cashboxRoutes(services));
  const request = (id: string, url: string, method: "GET" | "POST" | "PUT" = "GET", payload?: unknown) => app.inject({ url, method, headers: { authorization: `Bearer ${id}` }, ...(payload ? { payload } : {}) });
  return { db, sqlite, bus, cashbox, payments, app, request, time: (value: string) => { now = new Date(value); }, close: async () => { await app.close(); sqlite.close(); } };
}

test("dos recepcionistas consultan la misma caja y uno puede cerrar la apertura del otro", async () => {
  const f = await fixture(); try {
    const opened = await f.request("Ana", "/api/cashbox/shifts/open", "POST", { aperturaCentimos: 10000 });
    assert.equal(opened.statusCode, 200, opened.body);
    const id = opened.json().id;
    for (const user of ["Ana", "Luis", "Ana"]) assert.equal((await f.request(user, "/api/cashbox/shifts/current")).json().id, id);
    const payment = await f.payments.create({ saleId: "sale", detalles: [{ metodo: "EFECTIVO", montoCentimos: 2000, recibidoCentimos: 5000 }] });
    await f.payments.accept(payment.id, "Luis");
    assert.equal((await f.cashbox.getShiftSummary(id)).efectivoEsperadoCentimos, 12000);
    assert.equal((await f.cashbox.listMovements(id)).find(m => m.tipo === "VENTA")?.usuarioId, "Luis");
    const closed = await f.request("Luis", `/api/cashbox/shifts/${id}/close`, "POST", { denominaciones: { "2000": 6 } });
    assert.equal(closed.statusCode, 200, closed.body);
    assert.equal((await f.request("Ana", "/api/cashbox/shifts/current")).json(), null);
    assert.equal((await f.cashbox.listMovements(id)).find(m => m.tipo === "CIERRE")?.usuarioId, "Luis");
    assert.equal((await f.request("sin_permiso", "/api/cashbox/shifts/current")).statusCode, 403);
  } finally { await f.close(); }
});

test("aperturas simultáneas crean una sola caja compartida", async () => {
  const f = await fixture(); try {
    const results = await Promise.allSettled(["Ana", "Luis"].map(usuarioId => f.cashbox.openShift({ usuarioId, aperturaCentimos: 0 })));
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    assert.equal((await f.cashbox.listShifts()).length, 1);
  } finally { await f.close(); }
});

test("relevo de las 17:00 traslada fondo una vez sin inflar ventas ni inventar arqueo", async () => {
  const f = await fixture(); try {
    await f.cashbox.applyStandardSchedule("Ana");
    const first = await f.cashbox.openShift({ usuarioId: "Ana", aperturaCentimos: 10000 });
    await f.cashbox.addManualMovement({ turnoId: first.id, usuarioId: "Luis", tipo: "INGRESO", montoCentimos: 2500, motivo: "Fondo adicional" });
    f.time("2026-10-14T17:00:00-05:00");
    await Promise.all([f.cashbox.runTimers(), f.cashbox.runTimers(), f.cashbox.getOpenShift()]);
    const next = (await f.cashbox.getOpenShift())!;
    assert.notEqual(next.id, first.id); assert.equal(next.turnoAnteriorId, first.id); assert.equal(next.aperturaCentimos, 12500);
    const closed = await f.cashbox.getShift(first.id);
    assert.equal(closed.tipoCierre, "AUTOMATICO"); assert.equal(closed.cerradoEn, "2026-10-14T22:00:00.000Z");
    assert.equal(closed.efectivoDeclaradoCentimos, null); assert.equal(closed.diferenciaCentimos, null);
    assert.equal((await f.cashbox.getShiftSummary(first.id)).efectivoEsperadoCentimos, 12500);
    assert.equal((await f.cashbox.listShifts()).length, 2);
    const range = await f.cashbox.getRangeSummary({ desde: "2026-10-14", hasta: "2026-10-14" });
    assert.equal(range.efectivoEsperadoCentimos, 12500); assert.equal(range.ventasBrutasCentimos, 0); assert.equal(range.efectivoDeclaradoCentimos, null);
    const report = await f.request("Luis", `/api/cashbox/shifts/${first.id}/cuadre`);
    assert.equal(report.statusCode, 200, report.body); assert.equal(report.json().cerradoPor.nombre, "Sistema automático");
    assert.equal(report.json().shift.efectivoDeclaradoCentimos, null);
    assert.ok((await f.db.select().from(schema.auditLog)).some(a => a.accion === "RELEVO_AUTOMATICO" && a.usuarioId === "system"));
  } finally { await f.close(); }
});

test("cobro justo después del límite entra al turno nuevo aunque el temporizador no haya corrido", async () => {
  const f = await fixture(); try {
    await f.cashbox.applyStandardSchedule("Ana");
    const first = await f.cashbox.openShift({ usuarioId: "Ana", aperturaCentimos: 10000 });
    const payment = await f.payments.create({ saleId: "sale", detalles: [{ metodo: "EFECTIVO", montoCentimos: 2000 }] });
    f.time("2026-10-14T17:00:01-05:00"); await f.payments.accept(payment.id, "Luis");
    const next = (await f.cashbox.getOpenShift())!;
    assert.equal((await f.cashbox.listMovements(first.id)).filter(m => m.tipo === "VENTA").length, 0);
    assert.equal((await f.cashbox.listMovements(next.id)).find(m => m.tipo === "VENTA")?.usuarioId, "Luis");
    assert.equal((await f.cashbox.getShiftSummary(next.id)).efectivoEsperadoCentimos, 12000);
  } finally { await f.close(); }
});

test("reinicio recupera límites de medianoche y 01:00 con fecha de Lima e idempotencia", async () => {
  const f = await fixture(); try {
    await f.cashbox.applyStandardSchedule("Ana"); await f.cashbox.openShift({ usuarioId: "Ana", aperturaCentimos: 10000 });
    f.time("2026-10-15T01:00:00-05:00"); await f.cashbox.runTimers();
    const shift = (await f.cashbox.getOpenShift())!;
    assert.equal(shift.fecha, "2026-10-15"); assert.equal(shift.abiertoEn, "2026-10-15T06:00:00.000Z");
    assert.equal(shift.programadoHasta, "2026-10-15T14:00:00.000Z");
    assert.equal((await f.cashbox.listShifts()).length, 3);
    await f.cashbox.runTimers(); assert.equal((await f.cashbox.listShifts()).length, 3);
    f.time("2026-10-15T09:00:00-05:00"); await f.cashbox.runTimers(); assert.equal((await f.cashbox.listShifts()).length, 4);
  } finally { await f.close(); }
});

test("los horarios incompletos o superpuestos pausan la automatización y el preset no duplica", async () => {
  const f = await fixture(); try {
    await assert.rejects(f.cashbox.createShiftTemplate({ nombre: "Inválido", horaInicio: "25:00", horaFin: "09:00" }));
    await f.cashbox.createShiftTemplate({ nombre: "Día", horaInicio: "09:00", horaFin: "17:00" });
    assert.equal((await f.cashbox.getAutomation()).horarioValido, false);
    await assert.rejects(f.cashbox.setAutomation(true, "Ana"));
    await f.cashbox.applyStandardSchedule("Ana"); await f.cashbox.applyStandardSchedule("Luis");
    assert.equal((await f.cashbox.listShiftTemplates()).length, 3);
    assert.equal((await f.cashbox.getAutomation()).horarioValido, true);
    await f.cashbox.createShiftTemplate({ nombre: "Duplicado", horaInicio: "10:00", horaFin: "12:00" });
    assert.match((await f.cashbox.getAutomation()).problema!, /superpuestos/);
  } finally { await f.close(); }
});

test("desactivar relevos es auditable y un cierre manual no reabre la caja", async () => {
  const f = await fixture(); try {
    await f.cashbox.applyStandardSchedule("Ana"); const first = await f.cashbox.openShift({ usuarioId: "Ana", aperturaCentimos: 0 });
    await f.cashbox.setAutomation(false, "Luis"); f.time("2026-10-15T02:00:00-05:00"); await f.cashbox.runTimers();
    assert.equal((await f.cashbox.getOpenShift())?.id, first.id);
    await f.cashbox.closeShift({ turnoId: first.id, usuarioId: "Luis", denominaciones: {} });
    await f.cashbox.runTimers(); assert.equal(await f.cashbox.getOpenShift(), null);
    assert.ok((await f.db.select().from(schema.auditLog)).some(a => a.accion === "CAMBIAR_RELEVOS_AUTOMATICOS" && a.usuarioId === "Luis"));
  } finally { await f.close(); }
});

test("turnos legados se conservan, no cobran y se concilian sin tocar la caja activa", async () => {
  const f = await fixture(); try {
    const active = await f.cashbox.openShift({ usuarioId: "Ana", aperturaCentimos: 10000 });
    await f.db.insert(schema.cashboxTurnos).values({ id: "legacy", usuarioId: "Luis", fecha: "2026-10-13", abiertoEn: "2026-10-13T10:00:00.000Z", aperturaCentimos: 7000 });
    await f.db.insert(schema.cashboxMovimientos).values({ id: "legacy-open", turnoId: "legacy", usuarioId: "Luis", tipo: "APERTURA", montoCentimos: 7000, ocurridoEn: "2026-10-13T10:00:00.000Z" });
    const before = await f.cashbox.listMovements("legacy");
    assert.equal((await f.cashbox.getOpenShiftForUser("Luis"))?.id, active.id);
    assert.equal((await f.cashbox.getLegacyOpenShifts()).length, 1);
    await assert.rejects(f.cashbox.addManualMovement({ turnoId: "legacy", usuarioId: "Luis", tipo: "INGRESO", montoCentimos: 100, motivo: "No permitido" }), /no es la caja activa/);
    assert.deepEqual(await f.cashbox.listMovements("legacy"), before);
    await f.cashbox.closeShift({ turnoId: "legacy", usuarioId: "Luis", denominaciones: { "1000": 7 }, justificacion: "Conciliación revisada" });
    assert.equal((await f.cashbox.getOpenShift())?.id, active.id); assert.equal((await f.cashbox.getShiftSummary(active.id)).efectivoEsperadoCentimos, 10000);
  } finally { await f.close(); }
});

test("fallo durante el relevo revierte cierre, transferencia y apertura juntos", async () => {
  const f = await fixture(); try {
    await f.cashbox.applyStandardSchedule("Ana"); const shift = await f.cashbox.openShift({ usuarioId: "Ana", aperturaCentimos: 5000 });
    const unsub = f.bus.subscribe("cashbox.changed", () => { throw new Error("Fallo simulado"); }, { critical: true });
    f.time("2026-10-14T17:00:00-05:00"); await assert.rejects(f.cashbox.runTimers(), /Fallo simulado/); unsub();
    assert.equal((await f.cashbox.getShift(shift.id)).estado, "ABIERTO"); assert.equal((await f.cashbox.listShifts()).length, 1);
    assert.equal((await f.cashbox.listMovements(shift.id)).length, 1);
    await f.cashbox.runTimers(); assert.equal((await f.cashbox.listShifts()).length, 2);
  } finally { await f.close(); }
});

test("migración de cajas simultáneas preserva estados, importes y movimientos existentes", async () => {
  const f = await fixture(); try {
    f.sqlite.exec("DROP TABLE cashbox_configuracion");
    f.sqlite.exec("DELETE FROM __drizzle_migrations WHERE created_at >= 1791936000000");
    for (const [id, abiertoEn, aperturaCentimos] of [["old", "2026-10-13T10:00:00.000Z", 7000], ["new", "2026-10-14T10:00:00.000Z", 10000]] as const) {
      await f.db.insert(schema.cashboxTurnos).values({ id, usuarioId: id, fecha: abiertoEn.slice(0, 10), abiertoEn, aperturaCentimos });
      await f.db.insert(schema.cashboxMovimientos).values({ id, turnoId: id, usuarioId: id, tipo: "APERTURA", montoCentimos: aperturaCentimos, ocurridoEn: abiertoEn });
    }
    const before = f.sqlite.prepare("SELECT * FROM cashbox_turnos ORDER BY id").all();
    const movements = f.sqlite.prepare("SELECT * FROM cashbox_movimientos ORDER BY id").all();
    await runMigrations(f.db, f.sqlite);
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM cashbox_turnos ORDER BY id").all(), before);
    assert.deepEqual(f.sqlite.prepare("SELECT * FROM cashbox_movimientos ORDER BY id").all(), movements);
    assert.equal((await f.cashbox.getOpenShift())?.id, "new");
    assert.deepEqual((await f.cashbox.getLegacyOpenShifts()).map(s => s.id), ["old"]);
  } finally { await f.close(); }
});

test("relevo conserva un faltante contable sin convertirlo en fondo positivo", async () => {
  const f = await fixture(); try {
    await f.cashbox.applyStandardSchedule("Ana"); const first = await f.cashbox.openShift({ usuarioId: "Ana", aperturaCentimos: 0 });
    await f.cashbox.addManualMovement({ turnoId: first.id, usuarioId: "Luis", tipo: "AJUSTE", montoCentimos: -1000, motivo: "Faltante documentado" });
    f.time("2026-10-14T17:00:00-05:00"); const next = (await f.cashbox.getOpenShift())!;
    assert.equal(next.aperturaCentimos, -1000);
    assert.equal((await f.cashbox.getRangeSummary({ desde: "2026-10-14", hasta: "2026-10-14" })).efectivoEsperadoCentimos, -1000);
  } finally { await f.close(); }
});
