import type { ChargeCode } from "./pricing.js";
import type { PaymentMethod } from "./payments.js";
import type { DateRange } from "./common.js";

export interface PeriodTotals {
  ventasCentimos: number;
  cantidadVentas: number;
  cuartosAlquilados: number;
  ticketPromedioCentimos: number;
  ocupacionPct: number;
}

export interface ComparativePeriod {
  actual: PeriodTotals;
  anterior: PeriodTotals;
  /** Variación %, null si el periodo anterior no tuvo ventas (no se puede dividir por cero con sentido). */
  variacionVentasPct: number | null;
  variacionCuartosPct: number | null;
}

export interface OcupacionPorPiso {
  pisoId: string;
  pisoNombre: string;
  cuartosAlquilados: number;
}

export interface OcupacionPorCategoria {
  categoriaId: string;
  categoriaNombre: string;
  cuartosAlquilados: number;
  ingresosCentimos: number;
}

export interface IngresoPorModalidad {
  modalidadId: string;
  modalidadNombre: string;
  cantidad: number;
  ingresosCentimos: number;
}

export interface VentasPorRecepcionista {
  usuarioId: string;
  nombre: string;
  cantidadVentas: number;
  totalCentimos: number;
}

export interface ProductoRanking {
  productoId: string;
  nombre: string;
  cantidadVendida: number;
  totalCentimos: number;
}

export interface IngresoPorMetodo {
  metodo: PaymentMethod;
  cantidad: number;
  totalCentimos: number;
}

export interface CargoExtraTotal {
  codigo: ChargeCode;
  nombre: string;
  cantidad: number;
  totalCentimos: number;
}

/** diaSemana: 0 (domingo) – 6 (sábado). hora: 0–23. Sustenta las franjas tarifarias — TAR-02/DAS-13. */
export interface HoraPico {
  diaSemana: number;
  hora: number;
  cantidad: number;
}

export interface DashboardReport {
  rango: DateRange;
  comparativa: ComparativePeriod;
  ocupacionPorPiso: OcupacionPorPiso[];
  ocupacionPorCategoria: OcupacionPorCategoria[];
  ingresosPorModalidad: IngresoPorModalidad[];
  ventasPorRecepcionista: VentasPorRecepcionista[];
  rankingProductos: ProductoRanking[];
  ingresosPorMetodo: IngresoPorMetodo[];
  cargosExtra: CargoExtraTotal[];
  horasPico: HoraPico[];
}
