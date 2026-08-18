import type { ChargeCode } from "../entities/pricing.js";
import type { Sale, SaleLine, SaleWithLines } from "../entities/sales.js";

export interface OpenSaleForStayInput {
  stayId: string;
  usuarioId: string;
}

export interface AddExtraChargeInput {
  saleId: string;
  codigo: ChargeCode;
  cantidad: number;
  usuarioId: string;
}

export interface AddProductLineInput {
  saleId: string;
  productoId: string;
  cantidad: number;
  usuarioId: string;
}

/**
 * Public surface of `sales`. Owns the money total of a stay. Freezes prices
 * resolved from `PricingPort` into its own lines — once written, editing the
 * tariff later never changes an emitted sale (§3 of REGLAS-DE-NEGOCIO.md).
 *
 * `fase` (PRE_PAGO/POST_PAGO) is never taken from the caller — it's derived
 * from whether the sale is already paid at the moment the line is added
 * (§7 of REGLAS-DE-NEGOCIO.md). A caller can't misreport it.
 */
export interface SalesPort {
  openSaleForStay(input: OpenSaleForStayInput): Promise<Sale>;
  addExtraCharge(input: AddExtraChargeInput): Promise<SaleLine>;
  addProductLine(input: AddProductLineInput): Promise<SaleLine>;
  cancelLine(saleId: string, lineId: string, motivo: string, usuarioId: string): Promise<void>;

  getSale(id: string): Promise<SaleWithLines>;
  getSaleForStay(stayId: string): Promise<SaleWithLines | null>;
  listOpenSales(): Promise<Sale[]>;
  /** Ventas del rango de días (YYYY-MM-DD, inclusive), más nueva primero — historial de caja. */
  listSalesByRange(desde: string, hasta: string): Promise<Sale[]>;

  cancelSale(saleId: string, motivo: string, usuarioId: string): Promise<Sale>;
}
