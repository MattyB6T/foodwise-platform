import { CONFIG } from "./config";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers["Authorization"] = authToken;
  }

  const response = await fetch(`${CONFIG.API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Stores
  listStores: () => request<{ stores: any[] }>("GET", "/stores"),

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
  getPurchaseOrders: (storeId: string, status?: string) =>
    request<any>(
      "GET",
      `/stores/${storeId}/purchase-orders${status ? `?status=${status}` : ""}`
    ),
  getWaste: (storeId: string, startDate?: string) =>
    request<any>(
      "GET",
      `/stores/${storeId}/waste${startDate ? `?startDate=${startDate}` : ""}`
    ),
  getWasteAnalytics: (storeId: string, days?: number) =>
    request<any>(
      "GET",
      `/stores/${storeId}/waste/analytics${days ? `?days=${days}` : ""}`
    ),

  // Barcode
  lookupBarcode: (code: string, storeId?: string) =>
    request<any>(
      "GET",
      `/barcode/${code}${storeId ? `?storeId=${storeId}` : ""}`
    ),

  // Receiving
  receiveShipment: (storeId: string, body: { orderId?: string; scans: { barcode: string; quantity: number }[] }) =>
    request<any>("POST", `/stores/${storeId}/receive`, body),

  // Waste
  recordWaste: (storeId: string, body: { ingredientId: string; quantity: number; reason: string; notes?: string }) =>
    request<any>("POST", `/stores/${storeId}/waste`, body),

  // Purchase orders
  createPurchaseOrder: (body: any) =>
    request<any>("POST", "/purchase-orders", body),

  // Assistant
  askAssistant: (storeId: string, question: string) =>
    request<any>("POST", "/assistant", { storeId, question }),

  // Forecasts
  runForecast: () => request<any>("POST", "/forecasts"),

  // Cameras
  listCameras: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/cameras`),
  registerCamera: (storeId: string, body: { name: string; location: string; wyzeDeviceId: string; wyzeDeviceMac: string }) =>
    request<any>("POST", `/stores/${storeId}/cameras`, body),
  getCameraFootage: (storeId: string, cameraId: string, startTime: string, endTime: string) =>
    request<any>("GET", `/stores/${storeId}/cameras/${cameraId}/footage?startTime=${startTime}&endTime=${endTime}`),

  // Incidents
  listIncidents: (storeId: string, params?: { status?: string; startDate?: string; endDate?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.startDate) qs.set("startDate", params.startDate);
    if (params?.endDate) qs.set("endDate", params.endDate);
    const query = qs.toString();
    return request<any>("GET", `/stores/${storeId}/incidents${query ? `?${query}` : ""}`);
  },
  createIncident: (storeId: string, body: {
    type: string;
    title: string;
    notes: string;
    timestamp: string;
    cameraId?: string;
    transactionId?: string;
    wasteId?: string;
  }) => request<any>("POST", `/stores/${storeId}/incidents`, body),

  // Notifications
  registerPushToken: (body: { token: string; platform: string; storeId?: string }) =>
    request<any>("POST", "/notifications/register", body),
  getNotificationPrefs: () =>
    request<any>("GET", "/notifications/preferences"),
  updateNotificationPrefs: (body: { preferences?: Record<string, boolean>; enabled?: boolean }) =>
    request<any>("PUT", "/notifications/preferences", body),
  sendNotification: (body: { storeId: string; title: string; body: string; type: string }) =>
    request<any>("POST", "/notifications/send", body),

  // Inventory Counts
  createCount: (storeId: string, body?: { notes?: string }) =>
    request<any>("POST", `/stores/${storeId}/counts`, body),
  saveCount: (storeId: string, countId: string, body: { items: { itemId: string; actualQuantity: number }[]; status?: string }) =>
    request<any>("PUT", `/stores/${storeId}/counts/${countId}`, body),
  listCounts: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/counts`),
  getCountVariance: (storeId: string, countId: string) =>
    request<any>("GET", `/stores/${storeId}/counts/${countId}/variance`),

  // Expiration
  setExpiration: (storeId: string, body: { itemId: string; expirationDate: string; shelfLifeDays?: number }) =>
    request<any>("POST", `/stores/${storeId}/expiration`, body),
  getExpirationAlerts: (storeId: string, days?: number) =>
    request<any>("GET", `/stores/${storeId}/expiration/alerts${days ? `?days=${days}` : ""}`),

  // Staff
  listStaff: (storeId: string) =>
    request<any>("GET", `/stores/${storeId}/staff`),
  addStaff: (storeId: string, body: { email: string; name: string; role: string; phone?: string }) =>
    request<any>("POST", `/stores/${storeId}/staff`, body),
  updateStaff: (storeId: string, staffId: string, body: { name?: string; role?: string; active?: boolean; phone?: string }) =>
    request<any>("PUT", `/stores/${storeId}/staff/${staffId}`, body),
  removeStaff: (storeId: string, staffId: string) =>
    request<any>("DELETE", `/stores/${storeId}/staff/${staffId}`),

  // Schedule
  getSchedule: (storeId: string, weekStart?: string) =>
    request<any>("GET", `/stores/${storeId}/schedule${weekStart ? `?weekStart=${weekStart}` : ""}`),
  createShift: (storeId: string, body: { staffId: string; staffName: string; date: string; startTime: string; endTime: string; position?: string }) =>
    request<any>("POST", `/stores/${storeId}/schedule`, body),
  deleteShift: (storeId: string, shiftId: string) =>
    request<any>("DELETE", `/stores/${storeId}/schedule/${shiftId}`),

  // Time Clock
  getTimeEntries: (storeId: string, date?: string) =>
    request<any>("GET", `/stores/${storeId}/time-clock${date ? `?date=${date}` : ""}`),
  clockAction: (storeId: string, body: { action: string; entryId?: string; staffName?: string }) =>
    request<any>("POST", `/stores/${storeId}/time-clock`, body),

  // Vendor Communication
  emailPurchaseOrder: (orderId: string) =>
    request<any>("POST", `/purchase-orders/${orderId}/email`),

  // Temperature Logs
  getTempLogs: (storeId: string, startDate?: string) =>
    request<any>("GET", `/stores/${storeId}/temp-logs${startDate ? `?startDate=${startDate}` : ""}`),
  recordTempLog: (storeId: string, body: { location: string; temperature: number; unit?: string; notes?: string }) =>
    request<any>("POST", `/stores/${storeId}/temp-logs`, body),

  // Price History
  getPriceHistory: (supplierId: string, itemId?: string) =>
    request<any>("GET", `/price-history?supplierId=${supplierId}${itemId ? `&itemId=${itemId}` : ""}`),
  addPriceEntry: (body: { supplierId: string; itemId: string; itemName: string; price: number; unit: string }) =>
    request<any>("POST", "/price-history", body),

  // Reports
  generateReport: (body: { storeId: string; reportType: string; startDate?: string; endDate?: string; format?: string }) =>
    request<any>("POST", "/reports", body),

  // Transactions (for timeline view)
  getTransactions: (storeId: string, startDate?: string, endDate?: string) => {
    const qs = new URLSearchParams();
    if (startDate) qs.set("startDate", startDate);
    if (endDate) qs.set("endDate", endDate);
    const query = qs.toString();
    return request<any>("GET", `/stores/${storeId}/transactions${query ? `?${query}` : ""}`);
  },
};
