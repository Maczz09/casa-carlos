import type { Arqueo, CashboxAutomation, CashMovement, CashMovementType, CashSummary, Denominaciones, Shift, ShiftTemplate } from "../entities/cashbox.js";
import type { PaymentMethod } from "../entities/payments.js";
import type { DateRange } from "../entities/common.js";

export interface CreateShiftTemplateInput {
  nombre: string;
  horaInicio: string;
  horaFin: string;
  orden?: number;
}

export interface UpdateShiftTemplateInput {
  nombre?: string;
  horaInicio?: string;
  horaFin?: string;
  orden?: number;
  activa?: boolean;
}

export interface OpenShiftInput {
  usuarioId: string;
  plantillaId?: string | null;
  aperturaCentimos: number;
}

export interface CloseShiftInput {
  turnoId: string;
  usuarioId: string;
  /** Conteo billete por billete/moneda — el total declarado se calcula de acá, no se pide aparte. */
  denominaciones: Denominaciones;
  justificacion?: string | null;
}

export interface ManualMovementInput {
  turnoId: string;
  tipo: Extract<CashMovementType, "INGRESO" | "EGRESO" | "AJUSTE">;
  montoCentimos: number;
  motivo: string;
  usuarioId: string;
}

export interface RegistrarArqueoInput {
  turnoId: string;
  denominaciones: Denominaciones;
  usuarioId: string;
}

export interface CashMovementFilter {
  /** Instantes ISO inclusivos. Permiten combinar fecha y hora desde la UI. */
  desde?: string;
  hasta?: string;
  tipo?: CashMovementType;
  metodo?: PaymentMethod;
}

/**
 * Public surface of `cashbox`. Escucha `payment.accepted` para registrar
 * cada método de pago en el turno activo compartido del hotel. El movimiento
 * conserva al usuario que aceptó el pago; nunca escribe en `payments_*` ni `sales_*`.
 */
export interface CashboxPort {
  createShiftTemplate(input: CreateShiftTemplateInput, usuarioId?: string): Promise<ShiftTemplate>;
  updateShiftTemplate(id: string, input: UpdateShiftTemplateInput, usuarioId?: string): Promise<ShiftTemplate>;
  deleteShiftTemplate(id: string, usuarioId?: string): Promise<void>;
  applyStandardSchedule(usuarioId: string): Promise<ShiftTemplate[]>;
  getShiftTemplate(id: string): Promise<ShiftTemplate | null>;
  listShiftTemplates(): Promise<ShiftTemplate[]>;

  openShift(input: OpenShiftInput): Promise<Shift>;
  closeShift(input: CloseShiftInput): Promise<Shift>;
  getOpenShift(): Promise<Shift | null>;
  getLegacyOpenShifts(): Promise<Shift[]>;
  getAutomation(): Promise<CashboxAutomation>;
  setAutomation(habilitado: boolean, usuarioId: string): Promise<CashboxAutomation>;
  runTimers(now?: Date): Promise<void>;
  getOpenShiftForUser(usuarioId: string): Promise<Shift | null>;
  getShift(id: string): Promise<Shift>;
  listShifts(range?: DateRange): Promise<Shift[]>;

  addManualMovement(input: ManualMovementInput): Promise<CashMovement>;
  listMovements(turnoId: string): Promise<CashMovement[]>;
  listAllMovements(filter?: CashMovementFilter): Promise<CashMovement[]>;

  getShiftSummary(turnoId: string): Promise<CashSummary>;
  getRangeSummary(range: DateRange): Promise<CashSummary>;

  /** Conteo de caja a mitad de turno — no cierra nada, solo deja un registro con la diferencia contra lo esperado en ese momento. */
  registrarArqueo(input: RegistrarArqueoInput): Promise<Arqueo>;
  listArqueos(turnoId: string): Promise<Arqueo[]>;
  getArqueo(id: string): Promise<Arqueo | null>;
}
