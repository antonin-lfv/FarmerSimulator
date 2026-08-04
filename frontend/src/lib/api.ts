import type {
  BorrowResponse,
  BulkActionResponse,
  BulkProtectResponse,
  CalendarDay,
  CatalogDetail,
  CatalogItem,
  HireWorkerResponse,
  InventoryItem,
  Loan,
  MarketPrice,
  MarketPricePoint,
  NotificationList,
  NotificationSettings,
  OngoingAction,
  OutcomeResponse,
  ParcelDetail,
  Parcel,
  ResourceSelection,
  StartActionResponse,
  Storage,
  Wallet,
  Worker,
} from "./types";
import { emitMutation } from "./events";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(body || res.statusText, res.status);
  }
  // A mutation just succeeded (POST/PUT/DELETE) — let anything polling
  // unrelated data (navbar balance, storage, notifications) refresh right
  // away instead of waiting for its own timer.
  const method = init?.method?.toUpperCase();
  if (method && method !== "GET") emitMutation();
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  getWallet: () => request<Wallet>("/wallet"),
  cheatWallet: () => request<Wallet>("/wallet/cheat", { method: "POST" }),

  getParcels: () => request<Parcel[]>("/parcels"),
  getParcel: (id: number) => request<ParcelDetail>(`/parcels/${id}`),
  buyParcel: (id: number) => request<OutcomeResponse>(`/parcels/${id}/buy`, { method: "POST" }),
  upgradeStorage: (id: number) =>
    request<OutcomeResponse>(`/parcels/${id}/upgrade-storage`, { method: "POST" }),
  protectParcel: (id: number) =>
    request<OutcomeResponse>(`/parcels/${id}/protect`, { method: "POST" }),
  startAction: (
    id: number,
    body: { action_type: string; worker_id: number; resources: ResourceSelection[] },
  ) =>
    request<StartActionResponse>(`/parcels/${id}/actions`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getOngoingActions: () => request<OngoingAction[]>("/actions/ongoing"),

  bulkProtect: () => request<BulkProtectResponse>("/parcels/bulk/protect", { method: "POST" }),
  bulkStartAction: (actionType: string, resources: ResourceSelection[]) =>
    request<BulkActionResponse>("/parcels/bulk/actions", {
      method: "POST",
      body: JSON.stringify({ action_type: actionType, resources }),
    }),

  getCatalog: (params?: { category?: string; subcategory?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<CatalogItem[]>(`/catalog${qs ? `?${qs}` : ""}`);
  },
  getCatalogCategories: () => request<string[]>("/catalog/categories"),
  getCatalogDetail: (itemId: number) => request<CatalogDetail>(`/catalog/${itemId}/detail`),
  buyCatalogItem: (itemId: number, quantity: number) =>
    request<OutcomeResponse>(`/catalog/${itemId}/buy`, { method: "POST", body: JSON.stringify({ quantity }) }),

  getInventory: () => request<InventoryItem[]>("/inventory"),
  sellInventoryItem: (itemId: number, quantity: number) =>
    request<OutcomeResponse>(`/inventory/${itemId}/sell`, { method: "POST", body: JSON.stringify({ quantity }) }),

  getMarketPrices: () => request<MarketPrice[]>("/market/prices"),
  getMarketHistory: (subcategory: string) =>
    request<MarketPricePoint[]>(`/market/history?subcategory=${encodeURIComponent(subcategory)}`),
  sellHarvest: (itemId: number, quantity: number) =>
    request<OutcomeResponse>("/market/sell-harvest", {
      method: "POST",
      body: JSON.stringify({ item_id: itemId, quantity }),
    }),

  getWorkers: () => request<Worker[]>("/workers"),
  hireWorker: () => request<HireWorkerResponse>("/workers/hire", { method: "POST" }),
  fireWorker: (id: number) => request<OutcomeResponse>(`/workers/${id}/fire`, { method: "POST" }),

  getStorage: () => request<Storage>("/storage"),

  getLoans: () => request<Loan[]>("/bank/loans"),
  borrow: (amount: number) =>
    request<BorrowResponse>("/bank/loans", { method: "POST", body: JSON.stringify({ amount }) }),
  repayLoan: () => request<OutcomeResponse>("/bank/loans/repay", { method: "POST" }),

  getCalendar: () => request<CalendarDay>("/calendar"),
  getForecast: (days = 7) => request<CalendarDay[]>(`/calendar/forecast?days=${days}`),

  getNotifications: () => request<NotificationList>("/notifications"),
  markNotificationsRead: () => request<{ success: boolean }>("/notifications/read-all", { method: "POST" }),
  getNotificationSettings: () => request<NotificationSettings>("/notifications/settings"),
  updateNotificationSettings: (patch: Partial<NotificationSettings>) =>
    request<NotificationSettings>("/notifications/settings", {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
};

export { ApiError };
