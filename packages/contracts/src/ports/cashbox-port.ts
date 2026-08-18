import type { CashMovement, CashMovementType, CashSummary, Shift, ShiftTemplate } from "../entities/cashbox.js";
import type { DateRange } from "../entities/common.js";

export interface CreateShiftTemplateInput {
  nombre: string;
  horaInicio: string;
  horaFin: string;
}

export interface OpenShiftInput {
  usuarioId: string;
  plantillaId?: string | null;
  aperturaCentimos: number;
}

export interface CloseShiftInput {
  turnoId: string;
  usuarioId: string;
  efectivoDeclaradoCentimos: number;
  justificacion?: string | null;
}

export interface ManualMovementInput {
  turnoId: string;
  tipo: Extract<CashMovementType, "INGRESO" | "EGRESO">;
  montoCentimos: number;
  motivo: string;
  usuarioId: string;
}

/**
 * Public surface of `cashbox`. Escucha `payment.accepted` para registrar
 * cada método de pago como movimiento del turno abierto de quien aceptó el
 * pago — nunca escribe en `payments_*` ni `sales_*`.
 */
export interface CashboxPort {
  createShiftTemplate(input: CreateShiftTemplateInput): Promise<ShiftTemplate>;
  listShiftTemplates(): Promise<ShiftTemplate[]>;

  openShift(input: OpenShiftInput): Promise<Shift>;
  closeShift(input: CloseShiftInput): Promise<Shift>;
  getOpenShiftForUser(usuarioId: string): Promise<Shift | null>;
  getShift(id: string): Promise<Shift>;
  listShifts(range?: DateRange): Promise<Shift[]>;

  addManualMovement(input: ManualMovementInput): Promise<CashMovement>;
  listMovements(turnoId: string): Promise<CashMovement[]>;

  getShiftSummary(turnoId: string): Promise<CashSummary>;
  getRangeSummary(range: DateRange): Promise<CashSummary>;
}
