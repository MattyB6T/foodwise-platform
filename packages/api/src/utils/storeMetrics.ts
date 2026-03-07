import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  Store,
  InventoryItem,
  Transaction,
  WasteLog,
  StoreSnapshot,
  StoreStatus,
} from "@foodwise/shared";
import { docClient, TABLES } from "./dynamo";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function status(value: number, greenMax: number, yellowMax: number): StoreStatus {
  if (value <= greenMax) return "green";
  if (value <= yellowMax) return "yellow";
  return "red";
}

function scoreStatus(score: number): StoreStatus {
  if (score >= 75) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

export async function getStoreSnapshot(store: Store): Promise<StoreSnapshot> {
  const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 2 * THIRTY_DAYS_MS).toISOString();

  // Fetch inventory, recent transactions, waste logs in parallel
  const [inventoryRes, txRes, prevTxRes, wasteRes, forecastRes] =
    await Promise.all([
      docClient.send(
        new QueryCommand({
          TableName: TABLES.INVENTORY,
          KeyConditionExpression: "storeId = :s",
          ExpressionAttributeValues: { ":s": store.storeId },
        })
      ),
      docClient.send(
        new QueryCommand({
          TableName: TABLES.TRANSACTIONS,
          IndexName: "timestamp-index",
          KeyConditionExpression: "storeId = :s AND #ts >= :since",
          ExpressionAttributeNames: { "#ts": "timestamp" },
          ExpressionAttributeValues: { ":s": store.storeId, ":since": thirtyDaysAgo },
        })
      ),
      docClient.send(
        new QueryCommand({
          TableName: TABLES.TRANSACTIONS,
          IndexName: "timestamp-index",
          KeyConditionExpression: "storeId = :s AND #ts BETWEEN :start AND :end",
          ExpressionAttributeNames: { "#ts": "timestamp" },
          ExpressionAttributeValues: {
            ":s": store.storeId,
            ":start": sixtyDaysAgo,
            ":end": thirtyDaysAgo,
          },
        })
      ),
      docClient.send(
        new QueryCommand({
          TableName: TABLES.WASTE_LOGS,
          IndexName: "storeId-timestamp-index",
          KeyConditionExpression: "storeId = :s AND #ts >= :since",
          ExpressionAttributeNames: { "#ts": "timestamp" },
          ExpressionAttributeValues: { ":s": store.storeId, ":since": thirtyDaysAgo },
        })
      ),
      docClient.send(
        new QueryCommand({
          TableName: TABLES.FORECASTS,
          KeyConditionExpression: "forecastId = :fid",
          ExpressionAttributeValues: { ":fid": `latest-${store.storeId}` },
          Limit: 50,
        })
      ),
    ]);

  const inventory = (inventoryRes.Items || []) as InventoryItem[];
  const transactions = (txRes.Items || []) as Transaction[];
  const prevTransactions = (prevTxRes.Items || []) as Transaction[];
  const wasteLogs = (wasteRes.Items || []) as WasteLog[];

  // Food cost %
  const totalRevenue = transactions.reduce((s, tx) => s + tx.totalAmount, 0);
  const totalFoodCost = transactions.reduce((s, tx) => s + (tx.foodCost || 0), 0);
  const foodCostPercentage =
    totalRevenue > 0 ? Math.round((totalFoodCost / totalRevenue) * 10000) / 100 : 0;

  // Waste %
  const totalWasteCost = wasteLogs.reduce((s, w) => s + w.totalCost, 0);
  const wastePercentage =
    totalFoodCost > 0
      ? Math.round((totalWasteCost / totalFoodCost) * 10000) / 100
      : 0;

  // Sales trend
  const salesLast30d = totalRevenue;
  const salesPrev30d = prevTransactions.reduce((s, tx) => s + tx.totalAmount, 0);
  const salesChange = salesPrev30d > 0 ? (salesLast30d - salesPrev30d) / salesPrev30d : 0;
  const salesTrend: "up" | "down" | "flat" =
    salesChange > 0.05 ? "up" : salesChange < -0.05 ? "down" : "flat";

  // Forecast accuracy (compare forecast vs actual for recipes)
  const forecasts = forecastRes.Items || [];
  let forecastAccuracy = 0;
  if (forecasts.length > 0) {
    // Each forecast has predicted and actual fields
    let totalError = 0;
    let count = 0;
    for (const f of forecasts) {
      if (f.predicted && f.actual && f.actual > 0) {
        totalError += Math.abs(f.predicted - f.actual) / f.actual;
        count++;
      }
    }
    forecastAccuracy = count > 0 ? Math.round((1 - totalError / count) * 100) : 0;
    forecastAccuracy = Math.max(0, forecastAccuracy);
  }

  // Low stock count
  const lowStockCount = inventory.filter(
    (i) => i.lowStockThreshold > 0 && i.quantity <= i.lowStockThreshold
  ).length;

  // Health score (weighted average — matches getHealthScore.ts no-labor formula)
  const foodCostScore = Math.max(0, Math.min(100, 100 - Math.max(0, foodCostPercentage - 25) * 3));
  const wasteScore = Math.max(0, Math.min(100, 100 - wastePercentage * 10));
  const forecastScore = forecastAccuracy;
  const stockoutScore = inventory.length > 0
    ? Math.max(0, 100 - (lowStockCount / inventory.length) * 200)
    : 100;

  // Inventory turnover (days of inventory on hand)
  const totalInventoryValue = inventory.reduce(
    (s, i) => s + i.quantity * i.costPerUnit, 0
  );
  const dailyCOGS = totalFoodCost / 30;
  const inventoryTurnoverDays = dailyCOGS > 0 ? Math.round(totalInventoryValue / dailyCOGS) : 0;
  let inventoryTurnoverScore: number;
  if (inventoryTurnoverDays <= 3) {
    inventoryTurnoverScore = 60;
  } else if (inventoryTurnoverDays <= 7) {
    inventoryTurnoverScore = 100;
  } else if (inventoryTurnoverDays <= 14) {
    inventoryTurnoverScore = Math.max(50, 100 - (inventoryTurnoverDays - 7) * 7);
  } else {
    inventoryTurnoverScore = Math.max(0, 50 - (inventoryTurnoverDays - 14) * 3);
  }

  const healthScore = Math.round(
    foodCostScore * 0.3 +
    wasteScore * 0.25 +
    forecastScore * 0.25 +
    inventoryTurnoverScore * 0.1 +
    stockoutScore * 0.1
  );

  return {
    storeId: store.storeId,
    storeName: store.name,
    foodCostPercentage,
    foodCostStatus: status(foodCostPercentage, 30, 35),
    wastePercentage,
    wasteStatus: status(wastePercentage, 4, 7),
    healthScore,
    healthStatus: scoreStatus(healthScore),
    salesTrend,
    salesLast30d: Math.round(salesLast30d * 100) / 100,
    forecastAccuracy,
    lowStockCount,
  };
}

export async function getAllStores(): Promise<Store[]> {
  const result = await docClient.send(
    new ScanCommand({ TableName: TABLES.STORES })
  );
  return (result.Items || []) as Store[];
}
