// --- API Response Types ---

export interface ApiResponse<T> {
  statusCode: number;
  body: T;
}

export interface ErrorResponse {
  message: string;
  code: string;
}

// --- Operator Types ---

export type OperatorType = "qsr" | "cafe" | "bar" | "hybrid" | "restaurant";

export const OPERATOR_TYPE_LABELS: Record<OperatorType, string> = {
  qsr: "Quick Service / Fast Food",
  cafe: "Coffee Shop / Cafe",
  bar: "Bar / Nightclub",
  hybrid: "Bar + Restaurant / Gastropub",
  restaurant: "Full Service Restaurant",
};

/** Operator-specific configuration used by health score, assistant, and UI. */
export const OPERATOR_CONFIG: Record<OperatorType, {
  foodCostTarget: number;
  laborCostTarget: number;
  wasteTarget: number;
  primaryCostLabel: string;
  peakPattern: string;
  healthWeights: { foodCost: number; waste: number; forecast: number; turnover: number; stockout: number; labor: number };
  healthWeightsNoLabor: { foodCost: number; waste: number; forecast: number; turnover: number; stockout: number };
}> = {
  qsr: {
    foodCostTarget: 30, laborCostTarget: 30, wasteTarget: 4,
    primaryCostLabel: "Food Cost",
    peakPattern: "lunch and dinner peaks",
    healthWeights: { foodCost: 0.25, waste: 0.20, forecast: 0.20, turnover: 0.10, stockout: 0.10, labor: 0.15 },
    healthWeightsNoLabor: { foodCost: 0.30, waste: 0.25, forecast: 0.25, turnover: 0.10, stockout: 0.10 },
  },
  cafe: {
    foodCostTarget: 35, laborCostTarget: 35, wasteTarget: 5,
    primaryCostLabel: "Cost of Goods",
    peakPattern: "morning rush, weekday-heavy",
    healthWeights: { foodCost: 0.20, waste: 0.25, forecast: 0.20, turnover: 0.10, stockout: 0.10, labor: 0.15 },
    healthWeightsNoLabor: { foodCost: 0.25, waste: 0.30, forecast: 0.25, turnover: 0.10, stockout: 0.10 },
  },
  bar: {
    foodCostTarget: 22, laborCostTarget: 25, wasteTarget: 3,
    primaryCostLabel: "Pour Cost",
    peakPattern: "evening and late-night, weekend-heavy",
    healthWeights: { foodCost: 0.30, waste: 0.15, forecast: 0.15, turnover: 0.10, stockout: 0.10, labor: 0.20 },
    healthWeightsNoLabor: { foodCost: 0.35, waste: 0.20, forecast: 0.20, turnover: 0.10, stockout: 0.15 },
  },
  hybrid: {
    foodCostTarget: 28, laborCostTarget: 30, wasteTarget: 4,
    primaryCostLabel: "Food & Beverage Cost",
    peakPattern: "lunch and evening peaks (bimodal)",
    healthWeights: { foodCost: 0.25, waste: 0.20, forecast: 0.20, turnover: 0.10, stockout: 0.10, labor: 0.15 },
    healthWeightsNoLabor: { foodCost: 0.30, waste: 0.25, forecast: 0.25, turnover: 0.10, stockout: 0.10 },
  },
  restaurant: {
    foodCostTarget: 32, laborCostTarget: 33, wasteTarget: 4,
    primaryCostLabel: "Food Cost",
    peakPattern: "lunch and dinner service",
    healthWeights: { foodCost: 0.25, waste: 0.20, forecast: 0.20, turnover: 0.10, stockout: 0.10, labor: 0.15 },
    healthWeightsNoLabor: { foodCost: 0.30, waste: 0.25, forecast: 0.25, turnover: 0.10, stockout: 0.10 },
  },
};

// --- Store ---

export interface Store {
  storeId: string;
  ownerId: string;
  name: string;
  address: string;
  operatorType?: OperatorType;
  createdAt: string;
  updatedAt: string;
}

// --- Inventory ---

export interface InventoryItem {
  storeId: string;
  itemId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  lowStockThreshold: number;
  supplier?: string;
  updatedAt: string;
}

// --- Transaction ---

export interface TransactionLineItem {
  recipeId: string;
  recipeName: string;
  quantity: number;
  price: number;
}

export interface IngredientDeduction {
  itemId: string;
  itemName: string;
  quantityDeducted: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
}

export interface Transaction {
  storeId: string;
  transactionId: string;
  timestamp: string;
  lineItems: TransactionLineItem[];
  totalAmount: number;
  foodCost: number;
  foodCostPercentage: number;
  ingredientDeductions: IngredientDeduction[];
  createdAt: string;
}

// --- Recipe ---

export interface RecipeIngredient {
  itemId: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  recipeId: string;
  name: string;
  category: string;
  ingredients: RecipeIngredient[];
  sellingPrice: number;
  createdAt: string;
  updatedAt: string;
}

// --- Supplier ---

export interface CatalogItem {
  barcode: string;
  barcodeFormat: "GS1-128" | "UPC-A" | "EAN-13";
  itemId: string;
  itemName: string;
  unit: string;
  unitCost: number;
  casePack?: number;
}

export interface Supplier {
  supplierId: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  deliverySchedule: string;
  catalog: CatalogItem[];
  createdAt: string;
  updatedAt: string;
}

// --- Purchase Order ---

export type PurchaseOrderStatus = "draft" | "submitted" | "partial" | "received";

export interface PurchaseOrderLine {
  itemId: string;
  itemName: string;
  unit: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
}

export interface PurchaseOrder {
  orderId: string;
  storeId: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  expectedDeliveryDate: string;
  forecastId?: string;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
}

// --- Receiving ---

export interface ScannedItem {
  barcode: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  timestamp: string;
}

export interface ReceivingDiscrepancy {
  type: "quantity_mismatch" | "unexpected_item" | "price_change";
  itemId: string;
  itemName: string;
  expected?: number;
  actual: number;
  details: string;
}

export interface ReceivingLog {
  receivingId: string;
  storeId: string;
  orderId?: string;
  supplierId: string;
  supplierName: string;
  receivedBy: string;
  itemsScanned: ScannedItem[];
  discrepancies: ReceivingDiscrepancy[];
  totalItemsReceived: number;
  createdAt: string;
}

// --- Waste Tracking ---

export type WasteReason = "expired" | "damaged" | "over-prep" | "dropped" | "other";

export interface WasteLog {
  wasteId: string;
  storeId: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  totalCost: number;
  reason: WasteReason;
  notes?: string;
  loggedBy: string;
  timestamp: string;
  createdAt: string;
}

// --- Dashboard ---

export interface DashboardMetrics {
  storeId: string;
  inventorySummary: {
    totalItems: number;
    totalValue: number;
  };
  foodCostPercentage: number;
  wasteTotal: number;
  waste30d: {
    totalCost: number;
    totalEntries: number;
    topReasons: { reason: string; cost: number }[];
    topIngredients: { ingredientName: string; cost: number }[];
  };
  lowStockAlerts: {
    itemId: string;
    name: string;
    quantity: number;
    unit: string;
    threshold: number;
  }[];
  generatedAt: string;
}

// --- Owner Dashboard & Multi-Store ---

export type StoreStatus = "green" | "yellow" | "red";

export interface StoreSnapshot {
  storeId: string;
  storeName: string;
  foodCostPercentage: number;
  foodCostStatus: StoreStatus;
  wastePercentage: number;
  wasteStatus: StoreStatus;
  healthScore: number;
  healthStatus: StoreStatus;
  salesTrend: "up" | "down" | "flat";
  salesLast30d: number;
  forecastAccuracy: number;
  lowStockCount: number;
}

export interface OwnerDashboard {
  storeCount: number;
  stores: StoreSnapshot[];
  totals: {
    totalSales: number;
    avgFoodCostPercentage: number;
    totalWasteCost: number;
    avgHealthScore: number;
  };
  generatedAt: string;
}

export interface StoreComparisonMetric {
  storeId: string;
  storeName: string;
  value: number;
}

export interface ComparisonInsight {
  type: "warning" | "positive" | "suggestion";
  message: string;
}

export interface StoreComparison {
  metrics: {
    foodCostPercentage: StoreComparisonMetric[];
    wastePercentage: StoreComparisonMetric[];
    healthScore: StoreComparisonMetric[];
    salesLast30d: StoreComparisonMetric[];
    forecastAccuracy: StoreComparisonMetric[];
  };
  insights: ComparisonInsight[];
  generatedAt: string;
}

export interface HealthScoreBreakdown {
  storeId: string;
  storeName: string;
  overallScore: number;
  status: StoreStatus;
  components: {
    foodCostScore: number;
    wasteScore: number;
    forecastAccuracyScore: number;
    inventoryTurnoverScore: number;
    stockoutScore: number;
    laborEfficiencyScore?: number;
  };
  details: {
    foodCostPercentage: number;
    wastePercentage: number;
    forecastAccuracy: number;
    inventoryTurnoverDays: number;
    stockoutRate: number;
    laborCostPercentage?: number;
    totalLaborCost?: number;
    totalLaborHours?: number;
  };
  recommendations: string[];
  generatedAt: string;
}

// --- Camera / Surveillance ---

export type CameraLocation = "register" | "prep-area" | "drive-thru" | "storage" | "dining" | "entrance";

export interface Camera {
  cameraId: string;
  storeId: string;
  name: string;
  location: CameraLocation;
  wyzeDeviceId: string;
  wyzeDeviceMac: string;
  streamUrl?: string;
  thumbnailUrl?: string;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
}

// --- Incident Reports ---

export type IncidentStatus = "open" | "investigating" | "resolved" | "dismissed";
export type IncidentType = "theft" | "waste-verification" | "safety" | "discrepancy" | "other";

export interface Incident {
  incidentId: string;
  storeId: string;
  cameraId?: string;
  transactionId?: string;
  wasteId?: string;
  type: IncidentType;
  status: IncidentStatus;
  title: string;
  notes: string;
  timestamp: string;
  footageStartTime: string;
  footageEndTime: string;
  footageUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
