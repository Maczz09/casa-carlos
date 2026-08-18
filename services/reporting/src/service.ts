import type {
  CargoExtraTotal,
  ComparativePeriod,
  DashboardReport,
  DateRange,
  HoraPico,
  IngresoPorMetodo,
  IngresoPorModalidad,
  OcupacionPorCategoria,
  OcupacionPorPiso,
  PaymentMethod,
  PeriodTotals,
  ProductoRanking,
  ReportingPort,
  VentasPorRecepcionista,
} from "@casacarlos/contracts";
import { daysBetween, pctChange, previousRange, rangeBounds } from "./domain/period.js";
import { ReportingRepo } from "./repo.js";

type SalesRow = Awaited<ReturnType<ReportingRepo["salesInRange"]>>[number];
type LineRow = Awaited<ReturnType<ReportingRepo["linesForSales"]>>[number];

interface PeriodData {
  totals: PeriodTotals;
  sales: SalesRow[];
  lines: LineRow[];
}

export class ReportingService implements ReportingPort {
  constructor(private readonly repo: ReportingRepo) {}

  async getDashboard(range: DateRange): Promise<DashboardReport> {
    const prevRange = previousRange(range);
    const [actual, anterior] = await Promise.all([this.loadPeriod(range), this.loadPeriod(prevRange)]);

    const comparativa: ComparativePeriod = {
      actual: actual.totals,
      anterior: anterior.totals,
      variacionVentasPct: pctChange(actual.totals.ventasCentimos, anterior.totals.ventasCentimos),
      variacionCuartosPct: pctChange(actual.totals.cuartosAlquilados, anterior.totals.cuartosAlquilados),
    };

    const [rooms, floors, categories, modalities, users, products, charges] = await Promise.all([
      this.repo.activeRooms(),
      this.repo.floors(),
      this.repo.categories(),
      this.repo.modalities(),
      this.repo.users(),
      this.repo.products(),
      this.repo.charges(),
    ]);
    const { startIso, endIso } = rangeBounds(range);
    const [paymentDetails, stays] = await Promise.all([
      this.repo.acceptedPaymentDetailsInRange(startIso, endIso),
      this.repo.staysOverlapping(startIso, endIso),
    ]);

    const roomToFloor = new Map(rooms.map((r) => [r.id, r.pisoId]));
    const roomToCategoria = new Map(rooms.map((r) => [r.id, r.categoriaId]));
    const ventaToRoom = new Map(actual.sales.map((s) => [s.id, s.cuartoId]));
    const hostingLines = actual.lines.filter((l) => l.tipo === "HOSPEDAJE");
    const productLines = actual.lines.filter((l) => l.tipo === "PRODUCTO");
    const chargeLines = actual.lines.filter((l) => l.tipo === "CARGO_EXTRA");

    return {
      rango: range,
      comparativa,
      ocupacionPorPiso: this.byFloor(actual.sales, floors, roomToFloor),
      ocupacionPorCategoria: this.byCategoria(hostingLines, ventaToRoom, roomToCategoria, categories),
      ingresosPorModalidad: this.byModalidad(hostingLines, modalities),
      ventasPorRecepcionista: this.byRecepcionista(actual.sales, users),
      rankingProductos: this.byProducto(productLines, products),
      ingresosPorMetodo: this.byMetodo(paymentDetails),
      cargosExtra: this.byCargo(chargeLines, charges),
      horasPico: this.byHoraPico(stays, startIso, endIso),
    };
  }

  private async loadPeriod(range: DateRange): Promise<PeriodData> {
    const { startIso, endIso } = rangeBounds(range);
    const [sales, rooms, stays] = await Promise.all([
      this.repo.salesInRange(startIso, endIso),
      this.repo.activeRooms(),
      this.repo.staysOverlapping(startIso, endIso),
    ]);
    const lines = await this.repo.linesForSales(sales.map((s) => s.id));

    const ventasCentimos = sales.reduce((acc, s) => acc + s.totalCentimos, 0);
    const cantidadVentas = sales.length;
    const cuartosAlquilados = sales.filter((s) => s.cuartoId !== null).length;
    const ticketPromedioCentimos = cantidadVentas > 0 ? Math.round(ventasCentimos / cantidadVentas) : 0;

    const days = daysBetween(range);
    let occupiedRoomDays = 0;
    for (const day of days) {
      const dayStart = `${day}T00:00:00.000Z`;
      const dayEnd = `${day}T23:59:59.999Z`;
      const occupied = new Set(stays.filter((s) => s.bloqueoDesde <= dayEnd && s.bloqueoHasta >= dayStart).map((s) => s.cuartoId));
      occupiedRoomDays += occupied.size;
    }
    // Ocupación a granularidad de día (no de hora): suficiente para un hotel que mezcla
    // alquiler por horas y por noche, y evita modelar solapamientos parciales dentro del día.
    const ocupacionPct = rooms.length > 0 ? (occupiedRoomDays / (rooms.length * days.length)) * 100 : 0;

    return {
      totals: { ventasCentimos, cantidadVentas, cuartosAlquilados, ticketPromedioCentimos, ocupacionPct },
      sales,
      lines,
    };
  }

  private byFloor(sales: SalesRow[], floors: Awaited<ReturnType<ReportingRepo["floors"]>>, roomToFloor: Map<string, string>): OcupacionPorPiso[] {
    const counts = new Map<string, number>();
    for (const sale of sales) {
      if (!sale.cuartoId) continue;
      const pisoId = roomToFloor.get(sale.cuartoId);
      if (!pisoId) continue;
      counts.set(pisoId, (counts.get(pisoId) ?? 0) + 1);
    }
    return floors
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((f) => ({ pisoId: f.id, pisoNombre: f.nombre, cuartosAlquilados: counts.get(f.id) ?? 0 }));
  }

  private byCategoria(
    hostingLines: LineRow[],
    ventaToRoom: Map<string, string | null>,
    roomToCategoria: Map<string, string>,
    categories: Awaited<ReturnType<ReportingRepo["categories"]>>,
  ): OcupacionPorCategoria[] {
    const agg = new Map<string, { count: number; total: number }>();
    for (const line of hostingLines) {
      const roomId = ventaToRoom.get(line.ventaId);
      const categoriaId = roomId ? roomToCategoria.get(roomId) : undefined;
      if (!categoriaId) continue;
      const entry = agg.get(categoriaId) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += line.subtotalCentimos;
      agg.set(categoriaId, entry);
    }
    return categories.map((c) => ({
      categoriaId: c.id,
      categoriaNombre: c.nombre,
      cuartosAlquilados: agg.get(c.id)?.count ?? 0,
      ingresosCentimos: agg.get(c.id)?.total ?? 0,
    }));
  }

  private byModalidad(hostingLines: LineRow[], modalities: Awaited<ReturnType<ReportingRepo["modalities"]>>): IngresoPorModalidad[] {
    const agg = new Map<string, { count: number; total: number }>();
    for (const line of hostingLines) {
      if (!line.referenciaId) continue;
      const entry = agg.get(line.referenciaId) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += line.subtotalCentimos;
      agg.set(line.referenciaId, entry);
    }
    return modalities.map((m) => ({
      modalidadId: m.id,
      modalidadNombre: m.nombre,
      cantidad: agg.get(m.id)?.count ?? 0,
      ingresosCentimos: agg.get(m.id)?.total ?? 0,
    }));
  }

  private byRecepcionista(sales: SalesRow[], users: Awaited<ReturnType<ReportingRepo["users"]>>): VentasPorRecepcionista[] {
    const agg = new Map<string, { count: number; total: number }>();
    for (const sale of sales) {
      const entry = agg.get(sale.usuarioId) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += sale.totalCentimos;
      agg.set(sale.usuarioId, entry);
    }
    const userMap = new Map(users.map((u) => [u.id, u]));
    return [...agg.entries()]
      .map(([usuarioId, v]) => {
        const user = userMap.get(usuarioId);
        return {
          usuarioId,
          nombre: user ? `${user.nombres} ${user.apellidos}` : "Usuario eliminado",
          cantidadVentas: v.count,
          totalCentimos: v.total,
        };
      })
      .sort((a, b) => b.totalCentimos - a.totalCentimos);
  }

  private byProducto(productLines: LineRow[], products: Awaited<ReturnType<ReportingRepo["products"]>>): ProductoRanking[] {
    const agg = new Map<string, { qty: number; total: number }>();
    for (const line of productLines) {
      if (!line.referenciaId) continue;
      const entry = agg.get(line.referenciaId) ?? { qty: 0, total: 0 };
      entry.qty += line.cantidad;
      entry.total += line.subtotalCentimos;
      agg.set(line.referenciaId, entry);
    }
    const productMap = new Map(products.map((p) => [p.id, p]));
    return [...agg.entries()]
      .map(([productoId, v]) => ({
        productoId,
        nombre: productMap.get(productoId)?.nombre ?? "Producto eliminado",
        cantidadVendida: v.qty,
        totalCentimos: v.total,
      }))
      .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
      .slice(0, 10);
  }

  private byMetodo(details: Awaited<ReturnType<ReportingRepo["acceptedPaymentDetailsInRange"]>>): IngresoPorMetodo[] {
    const agg = new Map<PaymentMethod, { count: number; total: number }>();
    for (const d of details) {
      const metodo = d.metodo as PaymentMethod;
      const entry = agg.get(metodo) ?? { count: 0, total: 0 };
      entry.count += 1;
      entry.total += d.montoCentimos;
      agg.set(metodo, entry);
    }
    return [...agg.entries()].map(([metodo, v]) => ({ metodo, cantidad: v.count, totalCentimos: v.total })).sort((a, b) => b.totalCentimos - a.totalCentimos);
  }

  private byCargo(chargeLines: LineRow[], charges: Awaited<ReturnType<ReportingRepo["charges"]>>): CargoExtraTotal[] {
    const agg = new Map<string, { qty: number; total: number }>();
    for (const line of chargeLines) {
      if (!line.referenciaId) continue;
      const entry = agg.get(line.referenciaId) ?? { qty: 0, total: 0 };
      entry.qty += line.cantidad;
      entry.total += line.subtotalCentimos;
      agg.set(line.referenciaId, entry);
    }
    const chargeMap = new Map(charges.map((c) => [c.id, c]));
    return [...agg.entries()].map(([chargeId, v]) => {
      const charge = chargeMap.get(chargeId);
      return {
        codigo: (charge?.codigo ?? "EXCESO") as CargoExtraTotal["codigo"],
        nombre: charge?.nombre ?? "Cargo eliminado",
        cantidad: v.qty,
        totalCentimos: v.total,
      };
    });
  }

  private byHoraPico(stays: Awaited<ReturnType<ReportingRepo["staysOverlapping"]>>, startIso: string, endIso: string): HoraPico[] {
    const buckets = new Map<string, number>();
    for (const s of stays) {
      if (!s.checkinReal || s.checkinReal < startIso || s.checkinReal > endIso) continue;
      const d = new Date(s.checkinReal);
      const key = `${d.getUTCDay()}-${d.getUTCHours()}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()]
      .map(([key, cantidad]) => {
        const [diaSemana, hora] = key.split("-").map(Number);
        return { diaSemana, hora, cantidad } as HoraPico;
      })
      .sort((a, b) => (a.diaSemana - b.diaSemana) || (a.hora - b.hora));
  }
}
