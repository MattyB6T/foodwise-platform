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

  // Transactions (for timeline view)
  getTransactions: (storeId: string, startDate?: string, endDate?: string) => {
    const qs = new URLSearchParams();
    if (startDate) qs.set("startDate", startDate);
    if (endDate) qs.set("endDate", endDate);
    const query = qs.toString();
    return request<any>("GET", `/stores/${storeId}/transactions${query ? `?${query}` : ""}`);
  },
};
