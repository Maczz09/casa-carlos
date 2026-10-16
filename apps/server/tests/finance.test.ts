import test from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { openDatabase, runMigrations, schema, eq, afterCommit, atomic } from "@casacarlos/db";
import { InProcessBus } from "@casacarlos/bus";
import { createStaysService } from "@casacarlos/stays";
import { createSalesService } from "@casacarlos/sales";
import { createPaymentsService } from "@casacarlos/payments";
import { createCashboxService } from "@casacarlos/cashbox";
import { createInventoryService } from "@casacarlos/inventory";
import { cashboxRoutes } from "../src/routes/cashbox.js";
import { salesRoutes } from "../src/routes/sales.js";
import { receptionRoutes } from "../src/routes/reception.js";

async function fixture() {
  const { db, sqlite } = openDatabase(":memory:");
  await runMigrations(db, sqlite);
  const bus = new InProcessBus((notify) => afterCommit(db, notify));
  const modality = { id: "mod", codigo: "HORAS_3", nombre: "Tres horas", duracionHoras: 3, checkinFijo: null, checkoutFijo: null, toleranciaMin: 15, precioAdicionalCentimos: 1000, tiempoAdicionalMinutos: 60, bloqueoDiaCompleto: false, activo: true };
  const rooms: any = { assertAvailable: async () => {}, getRoom: async () => ({ id: "room", numero: "101", categoriaId: "cat" }), getRoomStatus: async () => "OCUPADO" };
  const pricing: any = { getModality: async () => modality, resolveRate: async () => ({ precioCentimos: 6000 }), getCharge: async () => ({ id: "charge", nombre: "Persona adicional", precioCentimos: 500 }) };
  const stays = createStaysService(db, bus, rooms, pricing);
  const inventory = createInventoryService(db, bus);
  const sales = createSalesService(db, bus, rooms, pricing, stays, inventory);
  const payments = createPaymentsService(db, bus, sales);
  const cashbox = createCashboxService(db, bus, payments);
  await db.insert(schema.inventoryProductos).values({ id: "water", nombre: "Agua", precioCentimos: 300, stock: 10, creadoEn: new Date().toISOString() });
  const stay = await stays.checkInWalkIn({ cuartoId: "room", modalidadId: "mod", cliente: { nombres: "Prueba", apellidos: "Contable", dni: "TEST" }, usuarioId: "recepcion_a", horaEntrada: new Date(Date.now() - 2 * 3600_000).toISOString() });
  const sale = await sales.openSaleForStay({ stayId: stay.id, usuarioId: "recepcion_a" });
  const pay = async (user: string, details?: any[]) => {
    const current = await sales.getSale(sale.id);
    const payment = await payments.create({ saleId: sale.id, detalles: details ?? [{ metodo: "EFECTIVO", montoCentimos: current.saldoCentimos }] });
    return payments.accept(payment.id, user);
  };
  const exceed = async () => {
    await db.update(schema.staysEstadias).set({ checkinReal: new Date(Date.now() - 5 * 3600_000).toISOString(), checkoutPrevisto: new Date(Date.now() - 80 * 60_000).toISOString(), estado: "EXCEDIDA" }).where(eq(schema.staysEstadias.id, stay.id));
    return sales.syncOverstayCharge(stay.id);
  };
  const user = (id: string) => ({ id, nombres: id, apellidos: "", permisos: ["CASHBOX_MANAGE", "SALES_MANAGE"], rol: "ADMIN" });
  const services: any = { sales, stays, payments, cashbox, identity: { getUser: async (id: string) => user(id), getUserByToken: async () => user("recepcion_b") }, sunatConfig: { read: () => ({ emisor: { razonSocial: "Prueba", ruc: "20100000000" } }) }, sunatModoActivo: "MOCK" };
  const app = Fastify();
  await app.register(cashboxRoutes(services));
  await app.register(salesRoutes(services));
  await app.register(receptionRoutes(services));
  const headers = { authorization: "Bearer test" };
  const cuadre = async (id: string) => {
    const result = await app.inject({ url: `/api/cashbox/shifts/${id}/cuadre`, headers });
    assert.equal(result.statusCode, 200, result.body);
    return result.json();
  };
  return { db, sqlite, bus, modality, stays, sales, payments, cashbox, inventory, stay, sale, pay, exceed, app, headers, cuadre, close: async () => { await app.close(); sqlite.close(); } };
}

test("caja cerrada, horas extra en otra caja, checkout y detalle permanente", async () => {
  const f = await fixture();
  try {
    const a = await f.cashbox.openShift({ usuarioId: "recepcion_a", aperturaCentimos: 0 });
    await f.pay("recepcion_a", [{ metodo: "EFECTIVO", montoCentimos: 6000, recibidoCentimos: 10000 }]);
    assert.equal((await f.cashbox.getShiftSummary(a.id)).efectivoEsperadoCentimos, 6000, "vuelto no se descuenta dos veces");
    await f.cashbox.closeShift({ turnoId: a.id, usuarioId: "recepcion_a", denominaciones: { "2000": 3 } });
    const original = await f.cashbox.listMovements(a.id);
    const b = await f.cashbox.openShift({ usuarioId: "recepcion_b", aperturaCentimos: 10000 });
    assert.equal((await f.exceed())?.saldoCentimos, 2000);
    await f.pay("recepcion_b", [{ metodo: "YAPE", montoCentimos: 2000, codigoOperacion: "123" }]);
    const result = await f.app.inject({ method: "POST", url: `/api/reception/check-out/${f.stay.id}`, headers: f.headers });
    assert.equal(result.statusCode, 200, result.body);
    const history = await f.sales.getSaleHistory(f.sale.id);
    assert.equal(history.venta.estado, "CERRADA");
    assert.equal(history.venta.totalCentimos, 8000);
    assert.equal(history.venta.saldoCentimos, 0);
    assert.equal(history.pagos.length, 2);
    assert.equal(history.turnos.length, 2);
    assert.ok(history.auditoria.some((a) => a.accion === "CERRAR_CHECKOUT" && a.usuarioId === "recepcion_b"));
    const report = await f.cuadre(b.id);
    assert.equal(report.ventasDetalle[0].cobradoTurnoCentimos, 2000);
    assert.equal(report.ventasDetalle[0].cobros.length, 1);
    assert.equal(report.ventasDetalle[0].cobros[0].usuarioNombre, "recepcion_b");
    assert.equal(report.ventasDetalle[0].vueltoCentimos, null, "no se arrastra vuelto del primer turno");
    f.modality.precioAdicionalCentimos = 9999;
    await f.sales.syncOverstayCharge(f.stay.id, new Date(Date.now() + 86400_000));
    assert.equal((await f.sales.getSale(f.sale.id)).totalCentimos, 8000);
    assert.deepEqual(await f.cashbox.listMovements(a.id), original);
    const repeated = await f.sales.checkOutStay(f.stay.id, "recepcion_b");
    assert.equal(repeated.estado, "FINALIZADA");
  } finally { await f.close(); }
});

test("anulación conserva caja cerrada y resta por método en caja del anulador una sola vez", async () => {
  const f = await fixture();
  try {
    const a = await f.cashbox.openShift({ usuarioId: "recepcion_a", aperturaCentimos: 0 });
    await f.pay("recepcion_a", [{ metodo: "EFECTIVO", montoCentimos: 4000, recibidoCentimos: 5000 }, { metodo: "YAPE", montoCentimos: 2000, codigoOperacion: "321" }]);
    await f.cashbox.closeShift({ turnoId: a.id, usuarioId: "recepcion_a", denominaciones: { "2000": 2 } });
    const before = await f.cashbox.listMovements(a.id);
    const b = await f.cashbox.openShift({ usuarioId: "recepcion_b", aperturaCentimos: 10000 });
    await f.sales.cancelSale({ saleId: f.sale.id, usuarioId: "recepcion_b", motivo: "Venta duplicada" });
    await f.sales.cancelSale({ saleId: f.sale.id, usuarioId: "recepcion_b", motivo: "Reintento" });
    assert.deepEqual(await f.cashbox.listMovements(a.id), before);
    const summary = await f.cashbox.getShiftSummary(b.id);
    assert.equal(summary.efectivoEsperadoCentimos, 6000);
    assert.equal(summary.ventasBrutasCentimos, -6000);
    const report = await f.cuadre(b.id);
    assert.equal(report.ventasDetalle[0].anuladoTurnoCentimos, 6000);
    const annulments = report.movimientos.filter((m: any) => m.tipo === "ANULACION");
    assert.equal(annulments.length, 2);
    assert.ok(annulments.every((m: any) => m.usuarioId === "recepcion_b" && m.motivo === "Venta duplicada"));
    assert.equal((await f.sales.getSaleHistory(f.sale.id)).pagos[0]?.estado, "ACEPTADO");
  } finally { await f.close(); }
});

test("falla contable revierte pago, venta y movimientos juntos", async () => {
  const f = await fixture();
  try {
    const a = await f.cashbox.openShift({ usuarioId: "recepcion_a", aperturaCentimos: 0 });
    const payment = await f.payments.create({ saleId: f.sale.id, detalles: [{ metodo: "EFECTIVO", montoCentimos: 6000 }] });
    const unsubscribe = f.bus.subscribe("payment.accepted", () => { throw new Error("Fallo simulado de caja"); }, { critical: true });
    await assert.rejects(f.payments.accept(payment.id, "recepcion_a"), /Fallo simulado/);
    assert.equal((await f.payments.getPayment(payment.id)).estado, "PENDIENTE");
    assert.equal((await f.sales.getSaleHistory(f.sale.id)).venta.pagadoCentimos, 0);
    assert.equal((await f.cashbox.listMovements(a.id)).filter((m) => m.tipo === "VENTA").length, 0);
    unsubscribe();
    await f.payments.accept(payment.id, "recepcion_a");
    assert.equal((await f.cashbox.getShiftSummary(a.id)).efectivoEsperadoCentimos, 6000);
  } finally { await f.close(); }
});

test("exceso: tolerancia, fracciones, tarifa congelada, exoneración y cargo manual", async () => {
  const f = await fixture();
  try {
    const deadline = new Date(f.stay.checkoutPrevisto).getTime() + 15 * 60_000;
    assert.equal((await f.sales.syncOverstayCharge(f.stay.id, new Date(deadline)))?.totalCentimos, 6000);
    assert.equal((await f.sales.syncOverstayCharge(f.stay.id, new Date(deadline + 1)))?.totalCentimos, 7000);
    f.modality.precioAdicionalCentimos = 2000;
    f.modality.tiempoAdicionalMinutos = 30;
    assert.equal((await f.sales.syncOverstayCharge(f.stay.id, new Date(deadline + 60 * 60_000)))?.totalCentimos, 7000);
    assert.equal((await f.sales.syncOverstayCharge(f.stay.id, new Date(deadline + 60 * 60_000 + 1)))?.totalCentimos, 8000);
    const manual = await f.sales.addExtraHours({ saleId: f.sale.id, usuarioId: "recepcion_a", horas: 1, precioUnitarioCentimos: 1500 });
    assert.equal(manual.referenciaId, "HORA_EXTRA_MANUAL");
    await f.sales.syncOverstayCharge(f.stay.id, new Date(deadline + 60 * 60_000 + 1));
    assert.equal((await f.sales.getSaleHistory(f.sale.id)).venta.lineas.find((l) => l.id === manual.id)?.subtotalCentimos, 1500);
    const auto = (await f.sales.getSaleHistory(f.sale.id)).venta.lineas.find((l) => l.referenciaId === "EXCESO_TIEMPO")!;
    await f.sales.cancelLine(f.sale.id, auto.id, "Exoneración autorizada", "recepcion_a");
    await f.sales.syncOverstayCharge(f.stay.id, new Date(deadline + 6 * 3600_000));
    const last = await f.sales.getSaleHistory(f.sale.id);
    assert.equal(last.venta.totalCentimos, 7500);
    assert.equal(last.venta.lineas.filter((l) => l.referenciaId === "EXCESO_TIEMPO").length, 1);
    assert.equal(last.venta.lineas.find((l) => l.id === auto.id)?.anulada, true);
  } finally { await f.close(); }
});

test("checkout retroactivo usa la hora elegida sin recalcular al presente", async () => {
  const f = await fixture();
  try {
    await f.cashbox.openShift({ usuarioId: "recepcion_a", aperturaCentimos: 0 });
    await f.pay("recepcion_a");
    await f.exceed();
    const stay = await f.stays.getStay(f.stay.id);
    const exitTime = new Date(Date.parse(stay.checkoutPrevisto) + 10 * 60_000).toISOString();
    const preview = await f.sales.previewCheckOut(stay.id, exitTime, true);
    await f.sales.confirmCheckOut(stay.id, "recepcion_a", { ...preview, motivo: "Huésped salió antes" });
    const final = await f.sales.getSaleHistory(f.sale.id);
    assert.equal(final.venta.totalCentimos, 6000);
    assert.equal(final.venta.estado, "CERRADA");
    assert.equal(final.estadia?.checkoutReal, exitTime);
    assert.ok(final.venta.lineas.some((l) => l.referenciaId === "EXCESO_TIEMPO" && l.anulada));
    const shift = await f.cashbox.getOpenShiftForUser("recepcion_a");
    const report = await f.cuadre(shift!.id);
    assert.ok(report.movimientos.some((m: any) => m.tipo === "CORRECCION" && m.montoCentimos === 0 && m.usuarioId === "recepcion_a"));
    assert.ok(report.ventasDetalle[0].cargosAnulados.some((l: any) => /Exceso/.test(l.descripcion)));
  } finally { await f.close(); }
});

test("rechazar un pago adicional conserva hospedaje; saldo impide checkout", async () => {
  const f = await fixture();
  try {
    await f.cashbox.openShift({ usuarioId: "recepcion_a", aperturaCentimos: 0 });
    await f.pay("recepcion_a");
    await f.exceed();
    const payment = await f.payments.create({ saleId: f.sale.id, detalles: [{ metodo: "EFECTIVO", montoCentimos: 2000 }] });
    await f.payments.reject(payment.id, "Método incorrecto", "recepcion_a");
    assert.notEqual((await f.stays.getStay(f.stay.id)).estado, "ANULADA");
    await assert.rejects(f.sales.checkOutStay(f.stay.id, "recepcion_a"), /saldo pendiente/);
    assert.notEqual((await f.sales.getSaleHistory(f.sale.id)).venta.estado, "CERRADA");
  } finally { await f.close(); }
});

test("producto sin stock revierte la línea y cancelación devuelve stock auditado", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.sales.addProductLine({ saleId: f.sale.id, productoId: "water", cantidad: 11, usuarioId: "recepcion_a" }));
    assert.equal((await f.sales.getSaleHistory(f.sale.id)).venta.totalCentimos, 6000);
    assert.equal((await f.inventory.getProduct("water")).stock, 10);
    await f.sales.addProductLine({ saleId: f.sale.id, productoId: "water", cantidad: 2, usuarioId: "recepcion_a" });
    await f.sales.cancelSale({ saleId: f.sale.id, usuarioId: "recepcion_a", motivo: "Error de ingreso" });
    assert.equal((await f.inventory.getProduct("water")).stock, 10);
    assert.ok((await f.sales.getSaleHistory(f.sale.id)).venta.lineas.some((l) => l.tipo === "PRODUCTO" && l.anulada));
  } finally { await f.close(); }
});

test("dos cuartos siguen acumulando exceso después del cierre de caja", async () => {
  const f = await fixture();
  try {
    const a = await f.cashbox.openShift({ usuarioId: "recepcion_a", aperturaCentimos: 0 });
    await f.pay("recepcion_a");
    const second = await f.stays.checkInWalkIn({ cuartoId: "room2", modalidadId: "mod", cliente: { nombres: "Segundo", apellidos: "Huésped", dni: "TEST2" }, usuarioId: "recepcion_a" });
    const secondSale = await f.sales.openSaleForStay({ stayId: second.id, usuarioId: "recepcion_a" });
    const payment = await f.payments.create({ saleId: secondSale.id, detalles: [{ metodo: "YAPE", montoCentimos: 6000, codigoOperacion: "456" }] });
    await f.payments.accept(payment.id, "recepcion_a");
    await f.cashbox.closeShift({ turnoId: a.id, usuarioId: "recepcion_a", denominaciones: { "2000": 3 } });
    await f.exceed();
    await f.db.update(schema.staysEstadias).set({ checkoutPrevisto: new Date(Date.now() - 80 * 60_000).toISOString(), estado: "EXCEDIDA" }).where(eq(schema.staysEstadias.id, second.id));
    await f.sales.syncAllActiveOverstays();
    assert.equal((await f.sales.getSaleHistory(secondSale.id)).venta.saldoCentimos, 2000);
    const b = await f.cashbox.openShift({ usuarioId: "recepcion_b", aperturaCentimos: 0 });
    await f.pay("recepcion_b");
    const extra = await f.payments.create({ saleId: secondSale.id, detalles: [{ metodo: "YAPE", montoCentimos: 2000, codigoOperacion: "789" }] });
    await f.payments.accept(extra.id, "recepcion_b");
    await f.sales.checkOutStay(f.stay.id, "recepcion_b");
    await f.sales.checkOutStay(second.id, "recepcion_b");
    const report = await f.cuadre(b.id);
    assert.equal(report.ventasDetalle.length, 2);
    assert.equal(report.summary.ventasBrutasCentimos, 4000);
    assert.ok(report.ventasDetalle.every((v: any) => v.estado === "CERRADA" && v.cobradoTurnoCentimos === 2000));
  } finally { await f.close(); }
});

test("migración repara cierre histórico con saldo cero sin cambiar dinero", async () => {
  const f = await fixture();
  try {
    const shift = await f.cashbox.openShift({ usuarioId: "recepcion_a", aperturaCentimos: 0 });
    await f.pay("recepcion_a");
    await f.stays.checkOut(f.stay.id, "recepcion_a");
    const movements = await f.cashbox.listMovements(shift.id);
    f.sqlite.exec("DELETE FROM __drizzle_migrations WHERE created_at >= 1791590400000; ALTER TABLE sales_lineas DROP COLUMN intervalo_minutos; ALTER TABLE stays_estadias DROP COLUMN salida_declarada_en;");
    await runMigrations(f.db, f.sqlite);
    const history = await f.sales.getSaleHistory(f.sale.id);
    assert.equal(history.venta.estado, "CERRADA");
    assert.equal(history.venta.totalCentimos, 6000);
    assert.ok(history.auditoria.some((a) => a.accion === "REPARAR_CIERRE_CHECKOUT"));
    assert.deepEqual(await f.cashbox.listMovements(shift.id), movements);
  } finally { await f.close(); }
});

test("pago parcial y restricciones de venta cerrada", async () => {
  const f = await fixture();
  try {
    await f.cashbox.openShift({ usuarioId: "recepcion_a", aperturaCentimos: 0 });
    const part = await f.payments.create({ saleId: f.sale.id, detalles: [{ metodo: "EFECTIVO", montoCentimos: 2000 }] });
    await f.payments.accept(part.id, "recepcion_a");
    assert.equal((await f.sales.getSaleHistory(f.sale.id)).venta.saldoCentimos, 4000);
    await f.pay("recepcion_a");
    await f.sales.checkOutStay(f.stay.id, "recepcion_a");
    await assert.rejects(f.sales.addExtraHours({ saleId: f.sale.id, usuarioId: "recepcion_a", horas: 1, precioUnitarioCentimos: 1000 }), /cerrada/);
    await assert.rejects(f.payments.create({ saleId: f.sale.id, detalles: [{ metodo: "EFECTIVO", montoCentimos: 1 }] }), /saldo cobrable/);
  } finally { await f.close(); }
});

test("horas manuales amplían salida, ajustan exceso cubierto y pago permite checkout", async () => {
  const f = await fixture();
  try {
    const shift = await f.cashbox.openShift({ usuarioId: "recepcion_a", aperturaCentimos: 0 });
    await f.pay("recepcion_a");
    await f.exceed();
    const before = await f.stays.getStay(f.stay.id);
    await f.sales.addExtraHours({ saleId: f.sale.id, horas: 2, precioUnitarioCentimos: 1000, usuarioId: "recepcion_a" });
    const extended = await f.stays.getStay(f.stay.id);
    assert.equal(Date.parse(extended.checkoutPrevisto) - Date.parse(before.checkoutPrevisto), 2 * 3600_000);
    assert.equal((await f.sales.getSale(f.sale.id)).saldoCentimos, 2000, "no cobra automático y manual por las mismas horas");
    await f.pay("recepcion_a");
    await f.sales.checkOutStay(f.stay.id, "recepcion_a");
    const history = await f.sales.getSaleHistory(f.sale.id);
    assert.equal(history.venta.estado, "CERRADA");
    assert.equal(history.venta.totalCentimos, 8000);
    assert.equal((await f.cashbox.getShiftSummary(shift.id)).ventasBrutasCentimos, 8000);
    assert.ok(history.auditoria.some((a) => a.accion === "AMPLIAR_HORAS" && a.usuarioId === "recepcion_a"));
  } finally { await f.close(); }
});

test("revisión es inmutable, requiere motivo y detecta cambios concurrentes", async () => {
  const f = await fixture();
  try {
    await f.exceed();
    const before = await f.sales.getSaleHistory(f.sale.id);
    const preview = await f.sales.previewCheckOut(f.stay.id, new Date().toISOString(), true);
    assert.deepEqual(await f.sales.getSaleHistory(f.sale.id), before);
    await assert.rejects(f.sales.confirmCheckOut(f.stay.id, "recepcion_a", { ...preview, motivo: "" }), /motivo/);
    await f.sales.addProductLine({ saleId: f.sale.id, productoId: "water", cantidad: 1, usuarioId: "recepcion_a" });
    await assert.rejects(f.sales.confirmCheckOut(f.stay.id, "recepcion_a", { ...preview, motivo: "Salida anterior" }), /cuenta cambió/);
    assert.equal((await f.stays.getStay(f.stay.id)).salidaDeclaradaEn, null);
  } finally { await f.close(); }
});

test("checkout fija salida antes de cobrar y evita nuevas horas durante el trámite", async () => {
  const f = await fixture();
  try {
    await f.cashbox.openShift({ usuarioId: "recepcion_b", aperturaCentimos: 0 });
    await f.exceed();
    const exitTime = new Date().toISOString();
    const preview = await f.sales.previewCheckOut(f.stay.id, exitTime, false);
    const response = await f.app.inject({ method: "POST", url: `/api/reception/check-out-confirm/${f.stay.id}`, headers: f.headers, payload: { ...preview, motivo: "Salida actual" } });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().finalizada, false);
    assert.equal((await f.sales.syncOverstayCharge(f.stay.id, new Date(Date.now() + 3 * 3600_000)))?.totalCentimos, 8000);
    await f.sales.syncAllActiveOverstays(new Date(Date.now() + 3 * 3600_000));
    assert.equal((await f.sales.getSale(f.sale.id)).saldoCentimos, 8000);
    await f.pay("recepcion_b");
    await f.sales.checkOutStay(f.stay.id, "recepcion_b");
    const history = await f.sales.getSaleHistory(f.sale.id);
    assert.equal(history.venta.estado, "CERRADA");
    assert.equal(history.estadia?.checkoutReal, exitTime);
    assert.equal(history.venta.totalCentimos, 8000);
    assert.ok(history.auditoria.some((a) => a.accion === "DECLARAR_SALIDA_REAL" && a.usuarioId === "recepcion_b"));
  } finally { await f.close(); }
});

test("corregir horas cobradas exige devolución, conserva caja anterior y cancela solo neto restante", async () => {
  const f = await fixture();
  try {
    const a = await f.cashbox.openShift({ usuarioId: "recepcion_a", aperturaCentimos: 0 });
    await f.pay("recepcion_a");
    await f.exceed();
    await f.pay("recepcion_a");
    await f.cashbox.closeShift({ turnoId: a.id, usuarioId: "recepcion_a", denominaciones: { "2000": 4 } });
    const original = await f.cashbox.listMovements(a.id);
    const stay = await f.stays.getStay(f.stay.id);
    const exitTime = new Date(Date.parse(stay.checkoutPrevisto) + 10 * 60_000).toISOString();
    const preview = await f.sales.previewCheckOut(f.stay.id, exitTime, true);
    assert.equal(preview.devolverCentimos, 2000);
    await assert.rejects(f.sales.confirmCheckOut(f.stay.id, "recepcion_b", { ...preview, motivo: "Salida antes del exceso" }), /Confirma la devolución/);
    await assert.rejects(f.sales.confirmCheckOut(f.stay.id, "recepcion_b", { ...preview, motivo: "Salida antes del exceso", confirmarDevolucion: true }), /caja/);
    assert.equal((await f.stays.getStay(f.stay.id)).salidaDeclaradaEn, null, "fallo revierte también la corrección");
    const b = await f.cashbox.openShift({ usuarioId: "recepcion_b", aperturaCentimos: 10000 });
    const result = await f.sales.confirmCheckOut(f.stay.id, "recepcion_b", { ...preview, motivo: "Salida antes del exceso", confirmarDevolucion: true });
    assert.equal(result.finalizada, true);
    assert.equal(result.venta.pagadoCentimos, 6000);
    assert.equal((await f.cashbox.getShiftSummary(b.id)).efectivoEsperadoCentimos, 8000);
    const report = await f.cuadre(b.id);
    assert.equal(report.ventasDetalle[0].devueltoTurnoCentimos, 2000);
    assert.ok(report.movimientos.some((m: any) => m.tipo === "DEVOLUCION" && m.usuarioId === "recepcion_b" && m.motivo === "Salida antes del exceso"));
    await f.sales.cancelSale({ saleId: f.sale.id, motivo: "Anulación posterior", usuarioId: "recepcion_b" });
    assert.equal((await f.cashbox.listMovements(b.id)).filter((m) => m.tipo === "ANULACION").reduce((sum, m) => sum + m.montoCentimos, 0), 6000);
    assert.equal((await f.cashbox.getShiftSummary(b.id)).efectivoEsperadoCentimos, 2000);
    assert.deepEqual(await f.cashbox.listMovements(a.id), original);
  } finally { await f.close(); }
});

test("devolución digital resta del método y conserva efectivo físico", async () => {
  const f = await fixture();
  try {
    const shift = await f.cashbox.openShift({ usuarioId: "recepcion_b", aperturaCentimos: 5000 });
    await f.pay("recepcion_b", [{ metodo: "EFECTIVO", montoCentimos: 6000 }]);
    await f.exceed();
    await f.pay("recepcion_b", [{ metodo: "YAPE", montoCentimos: 2000, codigoOperacion: "extra" }]);
    const preview = await f.sales.previewCheckOut(f.stay.id, new Date().toISOString(), true);
    assert.deepEqual(preview.devoluciones, [{ metodo: "YAPE", montoCentimos: 2000 }]);
    await f.sales.confirmCheckOut(f.stay.id, "recepcion_b", { ...preview, motivo: "Horas exoneradas", confirmarDevolucion: true });
    const summary = await f.cashbox.getShiftSummary(shift.id);
    assert.equal(summary.efectivoEsperadoCentimos, 11000);
    assert.equal(summary.porMetodo.find((m) => m.metodo === "YAPE")?.totalCentimos, 0);
    assert.equal(summary.ventasBrutasCentimos, 6000);
  } finally { await f.close(); }
});

test("rechazar método al cobrar salida registrada permite corregir pago sin anular estadía", async () => {
  const f = await fixture();
  try {
    await f.cashbox.openShift({ usuarioId: "recepcion_b", aperturaCentimos: 0 });
    const preview = await f.sales.previewCheckOut(f.stay.id, new Date().toISOString(), false);
    await f.sales.confirmCheckOut(f.stay.id, "recepcion_b", { ...preview, motivo: "Salida" });
    const payment = await f.payments.create({ saleId: f.sale.id, detalles: [{ metodo: "EFECTIVO", montoCentimos: 6000 }] });
    await f.payments.reject(payment.id, "Paga con tarjeta", "recepcion_b");
    assert.notEqual((await f.stays.getStay(f.stay.id)).estado, "ANULADA");
    await f.pay("recepcion_b", [{ metodo: "POS_DEBITO", montoCentimos: 6000 }]);
    await f.sales.checkOutStay(f.stay.id, "recepcion_b");
    assert.equal((await f.sales.getSaleHistory(f.sale.id)).venta.estado, "CERRADA");
  } finally { await f.close(); }
});

test("validación de horas y preview con tarifa histórica tras ampliación", async () => {
  const f = await fixture();
  try {
    await assert.rejects(f.sales.addExtraHours({ saleId: f.sale.id, horas: 1, precioUnitarioCentimos: 0, usuarioId: "recepcion_a" }), /enteros positivos/);
    await f.exceed();
    await f.sales.addExtraHours({ saleId: f.sale.id, horas: 2, precioUnitarioCentimos: 1000, usuarioId: "recepcion_a" });
    f.modality.precioAdicionalCentimos = 9999;
    f.modality.tiempoAdicionalMinutos = 15;
    // Al llegar al nuevo exceso se restaura la línea automática con su tarifa original.
    await f.db.update(schema.staysEstadias).set({ checkoutPrevisto: new Date(Date.now() - 30 * 60_000).toISOString() }).where(eq(schema.staysEstadias.id, f.stay.id));
    const preview = await f.sales.previewCheckOut(f.stay.id, new Date().toISOString(), false);
    assert.equal(preview.totalDespuesCentimos, 9000);
    const result = await f.sales.confirmCheckOut(f.stay.id, "recepcion_a", { ...preview, motivo: "Salida" });
    assert.equal(result.venta.totalCentimos, preview.totalDespuesCentimos);
  } finally { await f.close(); }
});

test("lecturas ajenas esperan la transacción y observan solo el saldo confirmado", async () => {
  const f = await fixture();
  try {
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>((r) => { entered = r; });
    const hold = new Promise<void>((r) => { release = r; });
    const transaction = atomic(f.db, async () => {
      await f.db.update(schema.inventoryProductos).set({ precioCentimos: 9999 }).where(eq(schema.inventoryProductos.id, "water"));
      entered();
      await hold;
      throw new Error("Reversión controlada");
    });
    const rejected = assert.rejects(transaction, /Reversión controlada/);
    await started;
    let readFinished = false;
    const read = f.inventory.getProduct("water").then((product) => { readFinished = true; return product; });
    await new Promise<void>((r) => setImmediate(r));
    assert.equal(readFinished, false);
    release();
    await rejected;
    assert.equal((await read).precioCentimos, 300);
  } finally { await f.close(); }
});

test("corregir salida anula intento pendiente de cobrar horas eliminadas y permite cerrar", async () => {
  const f = await fixture();
  try {
    await f.cashbox.openShift({ usuarioId: "recepcion_b", aperturaCentimos: 0 });
    await f.pay("recepcion_b");
    await f.exceed();
    const pending = await f.payments.create({ saleId: f.sale.id, detalles: [{ metodo: "EFECTIVO", montoCentimos: 2000 }] });
    const preview = await f.sales.previewCheckOut(f.stay.id, new Date().toISOString(), true);
    const result = await f.sales.confirmCheckOut(f.stay.id, "recepcion_b", { ...preview, motivo: "Salida previa al exceso" });
    assert.equal(result.finalizada, true);
    assert.equal(result.venta.totalCentimos, 6000);
    assert.equal((await f.payments.getPayment(pending.id)).estado, "RECHAZADO");
    assert.ok((await f.sales.getSaleHistory(f.sale.id)).auditoria.some((a) => a.accion === "RECHAZAR_POR_CORRECCION_SALIDA" && a.usuarioId === "recepcion_b"));
  } finally { await f.close(); }
});
