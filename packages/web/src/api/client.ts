import { CONFIG } from "../config";

let authToken: string | null = null;
let lastActivityTime: number = Date.now();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const TOKEN_KEY = "leantable_auth_token";

let onSessionExpired: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    lastActivityTime = Date.now();
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

export function loadPersistedToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    authToken = token;
    lastActivityTime = Date.now();
  }
  return token;
}

export function isSessionExpired(): boolean {
  if (!authToken) return false;
  return Date.now() - lastActivityTime > SESSION_TIMEOUT_MS;
}

export function setSessionExpiredCallback(cb: () => void) {
  onSessionExpired = cb;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (authToken && isSessionExpired()) {
    authToken = null;
    localStorage.removeItem(TOKEN_KEY);
    if (onSessionExpired) onSessionExpired();
    throw new Error("Session expired. Please log in again.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers["Authorization"] = authToken;
    lastActivityTime = Date.now();
  }

  const response = await fetch(`${CONFIG.API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && authToken) {
    authToken = null;
    localStorage.removeItem(TOKEN_KEY);
    if (onSessionExpired) onSessionExpired();
    throw new Error("Session expired. Please log in again.");
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Stores
  listStores: () => request<{ stores: any[] }>("GET", "/stores"),
  createStore: (body: { name: string; address: string; operatorType?: string }) =>
    request<any>("POST", "/stores", body),

  // Dashboard
  getOwnerDashboard: () => request<any>("GET", "/dashboard"),
  getStoreComparison: () => request<any>("GET", "/dashboard/comparison"),

  // Store-specific
  getStoreDashboard: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/dashboard`),
  getHealthScore: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/health-score`),
  getInventory: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/inventory`),
  updateInventory: (storeId: string, body: { items: { itemId?: string; name: string; category: string; quantity: number; unit: string; costPerUnit: number; lowStockThreshold: number }[] }) =>
    request<any>("POST", `/stores/${storeId}/inventory`, body),
  getPurchaseOrders: (storeId: string, status?: string) =>
    request<any>("GET", `/stores/${storeId}/purchase-orders${status ? `?status=${status}` : ""}`),
  getWaste: (storeId: string, startDate?: string) =>
    request<any>("GET", `/stores/${storeId}/waste${startDate ? `?startDate=${startDate}` : ""}`),
  getWasteAnalytics: (storeId: string, days?: number) =>
    request<any>("GET", `/stores/${storeId}/waste/analytics${days ? `?days=${days}` : ""}`),

  // Receiving
  receiveShipment: (storeId: string, body: { orderId?: string; scans: { barcode: string; quantity: number }[] }) =>
    request<any>("POST", `/stores/${storeId}/receive`, body),

  // Waste
  recordWaste: (storeId: string, body: { ingredientId: string; quantity: number; reason: string; notes?: string }) =>
    request<any>("POST", `/stores/${storeId}/waste`, body),

  // Purchase orders
  createPurchaseOrder: (body: any) =>
    request<any>("POST", "/purchase-orders", body),
  updatePurchaseOrder: (orderId: string, body: any) =>
    request<any>("PUT", `/purchase-orders/${orderId}`, body),
  emailPurchaseOrder: (orderId: string) =>
    request<any>("POST", `/purchase-orders/${orderId}/email`),
  receivePurchaseOrder: (orderId: string, body: { lines: { itemId: string; itemName: string; quantityReceived: number; unit: string }[] }) =>
    request<any>("POST", `/purchase-orders/${orderId}/receive`, body),

  // Assistant
  askAssistant: (storeId: string, question: string) =>
    request<any>("POST", "/assistant", { storeId, question }),

  // Forecasts
  runForecast: () => request<any>("POST", "/forecasts"),

  // Staff
  listStaff: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/staff`),
  addStaff: (storeId: string, body: { email: string; name: string; role: string; position?: string; phone?: string }) =>
    request<any>("POST", `/stores/${storeId}/staff`, body),
  updateStaff: (storeId: string, staffId: string, body: { name?: string; role?: string; position?: string; active?: boolean; phone?: string }) =>
    request<any>("PUT", `/stores/${storeId}/staff/${staffId}`, body),
  removeStaff: (storeId: string, staffId: string) =>
    request<any>("DELETE", `/stores/${storeId}/staff/${staffId}`),
  setStaffPin: (storeId: string, staffId: string, pin: string) =>
    request<any>("POST", `/stores/${storeId}/staff/${staffId}/pin`, { pin }),

  // Schedule
  getSchedule: (storeId: string, weekStart?: string) =>
    request<any>("GET", `/stores/${storeId}/schedule${weekStart ? `?weekStart=${weekStart}` : ""}`),
  createShift: (storeId: string, body: { staffId: string; staffName: string; date: string; startTime: string; endTime: string; position?: string }) =>
    request<any>("POST", `/stores/${storeId}/schedule`, body),
  deleteShift: (storeId: string, shiftId: string) =>
    request<any>("DELETE", `/stores/${storeId}/schedule/${shiftId}`),

  // Timesheets
  getTimesheetWeek: (storeId: string, week?: string) =>
    request<any>("GET", `/stores/${storeId}/timeclock${week ? `?week=${week}` : ""}`),
  getTimesheetLive: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/timeclock/live`),
  approveTimeEntry: (storeId: string, entryId: string) =>
    request<any>("POST", `/stores/${storeId}/timeclock/${entryId}/approve`),
  exportTimesheet: (storeId: string, week?: string) =>
    request<any>("GET", `/stores/${storeId}/timeclock/export${week ? `?week=${week}` : ""}`),

  // Expiration
  getExpirationAlerts: (storeId: string, days?: number) =>
    request<any>("GET", `/stores/${storeId}/expiration/alerts${days ? `?days=${days}` : ""}`),
  setExpiration: (storeId: string, body: { itemId: string; expirationDate: string; shelfLifeDays?: number }) =>
    request<any>("PUT", `/stores/${storeId}/expiration`, body),

  // Temperature Logs
  getTempLogs: (storeId: string, startDate?: string) =>
    request<any>("GET", `/stores/${storeId}/temp-logs${startDate ? `?startDate=${startDate}` : ""}`),
  recordTempLog: (storeId: string, body: { location: string; temperature: number; unit?: string; equipmentId?: string; equipmentName?: string; notes?: string }) =>
    request<any>("POST", `/stores/${storeId}/temp-logs`, body),

  // Inventory Counts
  createCount: (storeId: string, body?: { notes?: string }) =>
    request<any>("POST", `/stores/${storeId}/counts`, body),
  listCounts: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/counts`),
  saveCount: (storeId: string, countId: string, body: { items: { itemId: string; actualQuantity: number }[]; status?: string }) =>
    request<any>("PUT", `/stores/${storeId}/counts/${countId}`, body),
  getCountVariance: (storeId: string, countId: string) =>
    request<any>("GET", `/stores/${storeId}/counts/${countId}/variance`),

  // Reports
  generateReport: (body: { storeId: string; reportType: string; startDate?: string; endDate?: string; format?: string }) =>
    request<any>("POST", "/reports", body),

  // Transactions
  getTransactions: (storeId: string, startDate?: string, endDate?: string) => {
    const qs = new URLSearchParams();
    if (startDate) qs.set("startDate", startDate);
    if (endDate) qs.set("endDate", endDate);
    const query = qs.toString();
    return request<any>("GET", `/stores/${storeId}/transactions${query ? `?${query}` : ""}`);
  },

  // Revenue
  listRevenueSources: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/revenue-sources`),
  createRevenueSource: (storeId: string, body: { name: string; type: string }) =>
    request<any>("POST", `/stores/${storeId}/revenue-sources`, body),
  patchRevenueSource: (storeId: string, sourceId: string, body: { name?: string; isActive?: boolean }) =>
    request<any>("PATCH", `/stores/${storeId}/revenue-sources/${sourceId}`, body),
  listRevenueEntries: (storeId: string, params?: { startDate?: string; endDate?: string; sourceId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set("startDate", params.startDate);
    if (params?.endDate) qs.set("endDate", params.endDate);
    if (params?.sourceId) qs.set("sourceId", params.sourceId);
    const query = qs.toString();
    return request<any>("GET", `/stores/${storeId}/revenue-entries${query ? `?${query}` : ""}`);
  },

  // Revenue entries
  createRevenueEntry: (storeId: string, body: { sourceId: string; amount: number; date: string; note?: string }) =>
    request<any>("POST", `/stores/${storeId}/revenue-entries`, body),
  deleteRevenueEntry: (storeId: string, entryId: string) =>
    request<any>("DELETE", `/stores/${storeId}/revenue-entries/${entryId}`),

  // Store Settings
  getStoreSettings: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/settings`),
  updateStoreSettings: (storeId: string, body: { timeclock?: { maxShiftHours?: number; missedClockoutHours?: number; minBreakShiftHours?: number; flagShortShiftMinutes?: number }; tempRanges?: Record<string, { min: number; max: number; unit?: string }> }) =>
    request<any>("PUT", `/stores/${storeId}/settings`, body),

  // POS
  listPosConnections: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/pos/connections`),
  createPosConnection: (storeId: string, body: { posSystem: string; config?: any }) =>
    request<any>("POST", `/stores/${storeId}/pos/connections`, body),
  updatePosConnection: (storeId: string, connectionId: string, body: { status?: string; config?: any }) =>
    request<any>("PUT", `/stores/${storeId}/pos/connections/${connectionId}`, body),
  deletePosConnection: (storeId: string, connectionId: string) =>
    request<any>("DELETE", `/stores/${storeId}/pos/connections/${connectionId}`),
  listPosMappings: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/pos/mappings`),
  createPosMapping: (storeId: string, body: { posSystem: string; posItemId: string; posItemName: string; recipeId?: string; ingredientId?: string; quantityPerUnit?: number }) =>
    request<any>("POST", `/stores/${storeId}/pos/mappings`, body),
  updatePosMapping: (storeId: string, body: { posItemKey: string; recipeId?: string; ingredientId?: string; quantityPerUnit?: number; confidence?: number }) =>
    request<any>("PUT", `/stores/${storeId}/pos/mappings`, body),
  listPosTransactions: (storeId: string, limit?: number) =>
    request<any>("GET", `/stores/${storeId}/pos/transactions${limit ? `?limit=${limit}` : ""}`),
  getPosSyncStatus: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/pos/sync-status`),

  // Bulk Import
  importPreview: (storeId: string, body: { dataType: string; csvContent: string }) =>
    request<any>("POST", `/stores/${storeId}/import/preview`, body),
  importData: (storeId: string, body: { dataType: string; csvContent: string; columnOverrides?: Record<string, number> }) =>
    request<any>("POST", `/stores/${storeId}/import`, body),
  getImportTemplate: (storeId: string, dataType: string) =>
    `${CONFIG.API_URL}/stores/${storeId}/import/template?type=${dataType}`,

  // Recipes
  getRecipes: () => request<any>("GET", "/recipes"),
  getRecipe: (recipeId: string) => request<any>("GET", `/recipes/${recipeId}`),
  createRecipe: (body: { name: string; category: string; sellingPrice: number; ingredients: { itemId: string; quantity: number; unit: string }[] }) =>
    request<any>("POST", "/recipes", body),

  // Suppliers
  getSuppliers: () => request<any>("GET", "/suppliers"),

  // Menu Engineering
  getMenuEngineering: (storeId: string, days?: number) =>
    request<any>("GET", `/stores/${storeId}/menu-engineering${days ? `?days=${days}` : ""}`),

  // Prep Lists
  getPrepLists: (storeId: string, date?: string) =>
    request<any>("GET", `/stores/${storeId}/prep-lists${date ? `?date=${date}` : ""}`),
  generatePrepList: (storeId: string, body: { action: string; date?: string }) =>
    request<any>("POST", `/stores/${storeId}/prep-lists`, body),
  updatePrepList: (storeId: string, body: { prepListId: string; items: any[]; status?: string }) =>
    request<any>("POST", `/stores/${storeId}/prep-lists`, body),

  // Cameras & Incidents
  listCameras: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/cameras`),
  registerCamera: (storeId: string, body: { name: string; location: string; wyzeDeviceId: string; wyzeDeviceMac: string }) =>
    request<any>("POST", `/stores/${storeId}/cameras`, body),
  createIncident: (storeId: string, body: { type: string; title: string; notes: string; timestamp: string; cameraId?: string }) =>
    request<any>("POST", `/stores/${storeId}/incidents`, body),
  listIncidents: (storeId: string, params?: { startDate?: string; endDate?: string; type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set("startDate", params.startDate);
    if (params?.endDate) qs.set("endDate", params.endDate);
    if (params?.type) qs.set("type", params.type);
    const query = qs.toString();
    return request<any>("GET", `/stores/${storeId}/incidents${query ? `?${query}` : ""}`);
  },
};
