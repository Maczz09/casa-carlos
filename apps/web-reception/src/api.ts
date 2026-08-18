import type {
  AuthResult,
  Attribute,
  CashMovement,
  CashSummary,
  Category,
  ChargeCode,
  CollectionAccount,
  Comprobante,
  ComunicacionBaja,
  CreateRecipientInput,
  DashboardReport,
  DateRange,
  Floor,
  FloorBoard,
  KioskSession,
  Modality,
  NotificationEventCode,
  NotificationQueueItem,
  NotificationRecipient,
  NotificationState,
  NotificationTemplate,
  PaymentDetailInput,
  PaymentWithDetails,
  Product,
  ProductMovement,
  ProductState,
  ResolvedRate,
  SaleLine,
  SaleWithLines,
  Shift,
  ShiftTemplate,
  Stay,
  StayWithCustomer,
  UpdateRecipientInput,
  User,
} from "@casacarlos/contracts";

const TOKEN_KEY = "cc_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError((body as { error?: string } | null)?.error ?? `Error ${res.status}`);
  }
  return body as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });
const patch = <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined });

export const api = {
  login: (usuario: string, password: string) => post<AuthResult>("/api/auth/login", { usuario, password }),
  loginByPin: (pin: string) => post<AuthResult>("/api/auth/pin", { pin }),
  me: () => get<User>("/api/me"),

  board: () => get<FloorBoard[]>("/api/rooms/board"),
  floors: () => get<Floor[]>("/api/rooms/floors"),
  categories: () => get<Category[]>("/api/rooms/categories"),
  attributes: () => get<Attribute[]>("/api/rooms/attributes"),
  markCleaning: (roomId: string, minutes?: number) => post<unknown>(`/api/rooms/${roomId}/cleaning`, { minutes }),
  finishCleaning: (roomId: string) => post<unknown>(`/api/rooms/${roomId}/cleaning/finish`),

  modalities: () => get<Modality[]>("/api/pricing/modalities"),
  resolveRate: (categoriaId: string, modalidadId: string) =>
    get<ResolvedRate>(`/api/pricing/resolve?categoriaId=${encodeURIComponent(categoriaId)}&modalidadId=${encodeURIComponent(modalidadId)}`),

  checkOut: (stayId: string) => post<Stay>(`/api/reception/check-out/${stayId}`),

  startKiosk: (modalidadId: string, bloques: number, noches: number) =>
    post<KioskSession>("/api/reception/kiosk/start", { modalidadId, bloques, noches }),
  setKioskCustomer: (input: { nombres: string; apellidos: string; dni: string; telefono?: string | null }) =>
    post<KioskSession>("/api/reception/kiosk/customer", input),
  takeKioskControl: (actor: "CLIENTE" | "RECEPCION") => post<KioskSession>("/api/reception/kiosk/take-control", { actor }),
  cancelKiosk: (motivo?: string) => post<{ ok: true }>("/api/reception/kiosk/cancel", { motivo }),
  selectKioskFloor: (pisoId: string) => post<KioskSession>("/api/kiosk/select-floor", { pisoId }),
  selectKioskRoom: (cuartoId: string) => post<KioskSession>("/api/kiosk/select-room", { cuartoId }),

  activeStays: () => get<StayWithCustomer[]>("/api/stays/active"),
  getStay: (id: string) => get<StayWithCustomer>(`/api/stays/${id}`),
  cancelStay: (id: string, motivo: string) => post<Stay>(`/api/stays/${id}/cancel`, { motivo }),
  checkInReservation: (id: string) => post<Stay>(`/api/stays/${id}/check-in`),

  getSale: (id: string) => get<SaleWithLines>(`/api/sales/${id}`),
  getSaleForStay: (stayId: string) => get<SaleWithLines | null>(`/api/sales/for-stay/${stayId}`),
  addExtraCharge: (saleId: string, codigo: ChargeCode, cantidad: number) => post<SaleLine>(`/api/sales/${saleId}/extra-charge`, { codigo, cantidad }),
  addProductLine: (saleId: string, productoId: string, cantidad: number) =>
    post<SaleLine>(`/api/sales/${saleId}/product-line`, { productoId, cantidad }),
  cancelLine: (saleId: string, lineId: string, motivo: string) => post<{ ok: true }>(`/api/sales/${saleId}/lines/${lineId}/cancel`, { motivo }),

  createPayment: (saleId: string, detalles: PaymentDetailInput[]) => post<PaymentWithDetails>("/api/payments", { saleId, detalles }),
  acceptPayment: (id: string) => post<PaymentWithDetails>(`/api/payments/${id}/accept`),
  rejectPayment: (id: string, motivo: string) => post<PaymentWithDetails>(`/api/payments/${id}/reject`, { motivo }),
  collectionAccounts: () => get<CollectionAccount[]>("/api/kiosk/collection-accounts"),

  // ---- inventory ----
  products: () => get<Product[]>("/api/inventory/products"),
  product: (id: string) => get<Product>(`/api/inventory/products/${id}`),
  findByBarcode: (code: string) => get<Product | null>(`/api/inventory/products/barcode/${encodeURIComponent(code)}`),
  lowStock: () => get<Product[]>("/api/inventory/low-stock"),
  productMovements: (id: string) => get<ProductMovement[]>(`/api/inventory/products/${id}/movements`),
  createProduct: (input: {
    codigoBarras?: string | null;
    nombre: string;
    descripcion?: string | null;
    categoria?: string | null;
    precioCentimos: number;
    costoCentimos?: number;
    stockInicial?: number;
    stockMinimo?: number;
  }) => post<Product>("/api/inventory/products", input),
  updateProduct: (
    id: string,
    patchBody: { nombre?: string; descripcion?: string | null; categoria?: string | null; precioCentimos?: number; costoCentimos?: number; stockMinimo?: number; estado?: ProductState },
  ) => patch<Product>(`/api/inventory/products/${id}`, patchBody),
  stockIn: (id: string, cantidad: number, motivo: string) => post<ProductMovement>(`/api/inventory/products/${id}/stock-in`, { cantidad, motivo }),
  adjustStock: (id: string, cantidad: number, motivo: string) => post<ProductMovement>(`/api/inventory/products/${id}/adjust`, { cantidad, motivo }),

  // ---- cashbox ----
  shiftTemplates: () => get<ShiftTemplate[]>("/api/cashbox/templates"),
  createShiftTemplate: (input: { nombre: string; horaInicio: string; horaFin: string }) => post<ShiftTemplate>("/api/cashbox/templates", input),
  myShift: () => get<Shift | null>("/api/cashbox/shifts/mine"),
  shifts: (range?: { desde: string; hasta: string }) =>
    get<Shift[]>(`/api/cashbox/shifts${range ? `?desde=${range.desde}&hasta=${range.hasta}` : ""}`),
  shift: (id: string) => get<Shift>(`/api/cashbox/shifts/${id}`),
  openShift: (input: { plantillaId?: string | null; aperturaCentimos: number }) => post<Shift>("/api/cashbox/shifts/open", input),
  closeShift: (id: string, input: { efectivoDeclaradoCentimos: number; justificacion?: string | null }) =>
    post<Shift>(`/api/cashbox/shifts/${id}/close`, input),
  addCashMovement: (id: string, input: { tipo: "INGRESO" | "EGRESO"; montoCentimos: number; motivo: string }) =>
    post<CashMovement>(`/api/cashbox/shifts/${id}/movements`, input),
  shiftMovements: (id: string) => get<CashMovement[]>(`/api/cashbox/shifts/${id}/movements`),
  shiftSummary: (id: string) => get<CashSummary>(`/api/cashbox/shifts/${id}/summary`),
  rangeSummary: (range: { desde: string; hasta: string }) => get<CashSummary>(`/api/cashbox/summary?desde=${range.desde}&hasta=${range.hasta}`),

  // ---- reporting ----
  dashboard: (range: DateRange) => get<DashboardReport>(`/api/reporting/dashboard?desde=${range.desde}&hasta=${range.hasta}`),

  // ---- notifications ----
  notificationRecipients: () => get<NotificationRecipient[]>("/api/notifications/recipients"),
  createNotificationRecipient: (input: CreateRecipientInput) => post<NotificationRecipient>("/api/notifications/recipients", input),
  updateNotificationRecipient: (id: string, input: UpdateRecipientInput) => patch<NotificationRecipient>(`/api/notifications/recipients/${id}`, input),
  notificationTemplates: () => get<NotificationTemplate[]>("/api/notifications/templates"),
  updateNotificationTemplate: (codigo: NotificationEventCode, cuerpo: string) => patch<NotificationTemplate>(`/api/notifications/templates/${codigo}`, { cuerpo }),
  notificationQueue: (estado?: NotificationState) => get<NotificationQueueItem[]>(`/api/notifications/queue${estado ? `?estado=${estado}` : ""}`),
  retryNotification: (id: string) => post<NotificationQueueItem>(`/api/notifications/queue/${id}/retry`),

  // ---- billing (SUNAT) ----
  issueBoleta: (ventaId: string) => post<Comprobante>("/api/billing/boleta", { ventaId }),
  issueFactura: (ventaId: string, ruc: string, razonSocial: string) => post<Comprobante>("/api/billing/factura", { ventaId, ruc, razonSocial }),
  comprobanteForSale: (ventaId: string) => get<Comprobante | null>(`/api/billing/for-sale/${ventaId}`),
  getComprobante: (id: string) => get<Comprobante>(`/api/billing/${id}`),
  retryComprobante: (id: string) => post<Comprobante>(`/api/billing/${id}/retry`),
  comprobanteXmlUrl: (id: string) => `/api/billing/${id}/xml`,
  comprobantePdfUrl: (id: string) => `/api/billing/${id}/pdf`,
  bajaForComprobante: (id: string) => get<ComunicacionBaja | null>(`/api/billing/${id}/baja`),
  voidComprobante: (id: string, motivo: string) => post<ComunicacionBaja>(`/api/billing/${id}/void`, { motivo }),
};

export { ApiError };
