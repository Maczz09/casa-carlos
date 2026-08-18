import type { CollectionAccount, PaymentMethod, PaymentWithDetails } from "../entities/payments.js";

export interface PaymentDetailInput {
  metodo: PaymentMethod;
  montoCentimos: number;
  codigoOperacion?: string | null;
  ordenanteNombres?: string | null;
  ordenanteApellidos?: string | null;
  bancoOrigen?: string | null;
  recibidoCentimos?: number | null;
}

export interface CreatePaymentInput {
  saleId: string;
  detalles: PaymentDetailInput[];
}

export interface CreateCollectionAccountInput {
  tipo: "BANCO" | "BILLETERA";
  proveedor: string;
  titular: string;
  numeroCuenta?: string | null;
  cci?: string | null;
  qrImagenUrl?: string | null;
  orden?: number;
}

/**
 * Public surface of `payments`. A payment is born PENDIENTE with 1..n
 * details (hybrid payments); only a receptionist's explicit accept/reject
 * resolves it — the system never self-accepts a payment.
 */
export interface PaymentsPort {
  create(input: CreatePaymentInput): Promise<PaymentWithDetails>;
  accept(paymentId: string, usuarioId: string): Promise<PaymentWithDetails>;
  reject(paymentId: string, motivo: string, usuarioId: string): Promise<PaymentWithDetails>;
  getPayment(id: string): Promise<PaymentWithDetails>;
  getForSale(saleId: string): Promise<PaymentWithDetails[]>;

  createCollectionAccount(input: CreateCollectionAccountInput): Promise<CollectionAccount>;
  listCollectionAccounts(): Promise<CollectionAccount[]>;
}
