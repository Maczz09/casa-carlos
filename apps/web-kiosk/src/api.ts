import type { Attribute, Category, CollectionAccount, Floor, FloorBoard, Modality, ProposedPaymentLine } from "@casacarlos/contracts";

class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError((body as { error?: string } | null)?.error ?? `Error ${res.status}`);
  return body as T;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined });

export const api = {
  board: () => get<FloorBoard[]>("/api/kiosk/board"),
  floors: () => get<Floor[]>("/api/kiosk/floors"),
  categories: () => get<Category[]>("/api/kiosk/categories"),
  attributes: () => get<Attribute[]>("/api/kiosk/attributes"),
  collectionAccounts: () => get<CollectionAccount[]>("/api/kiosk/collection-accounts"),
  modalities: () => get<Modality[]>("/api/kiosk/modalities"),

  selectFloor: (pisoId: string) => post("/api/kiosk/select-floor", { pisoId }),
  selectRoom: (cuartoId: string) => post("/api/kiosk/select-room", { cuartoId }),
  proposePayment: (detalles: ProposedPaymentLine[]) => post("/api/kiosk/propose-payment", { detalles }),
  reset: () => post("/api/kiosk/reset"),
};

export { ApiError };
