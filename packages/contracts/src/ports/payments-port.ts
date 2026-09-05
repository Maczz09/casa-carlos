import type { ImageMimeType } from "../entities/common.js";
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
  /** Obligatorio para una billetera (YAPE/PLIN/LEMON/AGORA). Un banco siempre cobra como TRANSFERENCIA. */
  proveedor: string;
  titular: string;
  telefono?: string | null;
  numeroCuenta?: string | null;
  cci?: string | null;
  notas?: string | null;
  orden?: number;
}

export interface UpdateCollectionAccountInput {
  proveedor?: string;
  titular?: string;
  telefono?: string | null;
  numeroCuenta?: string | null;
  cci?: string | null;
  notas?: string | null;
  orden?: number;
  activa?: boolean;
}

export interface CollectionAccountQrInput {
  archivo: string;
  mimeType: ImageMimeType;
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

  /** Solo los canales activos, en orden — lo que ve el huésped en el kiosco. */
  listCollectionAccounts(): Promise<CollectionAccount[]>;
  /** Incluye los desactivados — la vista de administración. */
  listAllCollectionAccounts(): Promise<CollectionAccount[]>;
  createCollectionAccount(input: CreateCollectionAccountInput, usuarioId: string): Promise<CollectionAccount>;
  updateCollectionAccount(id: string, input: UpdateCollectionAccountInput, usuarioId: string): Promise<CollectionAccount>;
  deleteCollectionAccount(id: string, usuarioId: string): Promise<CollectionAccount>;
  /** Devuelve la cuenta ya actualizada y el archivo del QR anterior, para que quien maneja el disco lo borre. */
  setCollectionAccountQr(id: string, qr: CollectionAccountQrInput, usuarioId: string): Promise<{ cuenta: CollectionAccount; archivoAnterior: string | null }>;
  clearCollectionAccountQr(id: string, usuarioId: string): Promise<{ cuenta: CollectionAccount; archivoAnterior: string | null }>;
}
