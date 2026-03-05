// --- API Response Types ---

export interface ApiResponse<T> {
  statusCode: number;
  body: T;
}

export interface ErrorResponse {
  message: string;
  code: string;
}

// --- Store ---

export interface Store {
  storeId: string;
  ownerId: string;
  name: string;
  address: string;
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

// --- Dashboard ---

export interface DashboardMetrics {
  storeId: string;
  inventorySummary: {
    totalItems: number;
    totalValue: number;
  };
  foodCostPercentage: number;
  wasteTotal: number;
  lowStockAlerts: {
    itemId: string;
    name: string;
    quantity: number;
    unit: string;
    threshold: number;
  }[];
  generatedAt: string;
}
