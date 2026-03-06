import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  Store,
  InventoryItem,
  Transaction,
  WasteLog,
  HealthScoreBreakdown,
  StoreStatus,
} from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

function scoreStatus(score: number): StoreStatus {
  if (score >= 75) return "green";
  if (score >= 50) return "yellow";
  return "red";
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const storeId = event.pathParameters?.storeId;
    if (!storeId) {
      return error("storeId is required", 400);
    }

    // Fetch store info
    const storeRes = await docClient.send(
      new GetCommand({ TableName: TABLES.STORES, Key: { storeId } })
    );
    if (!storeRes.Item) {
      return error("Store not found", 404, "STORE_NOT_FOUND");
    }
    const store = storeRes.Item as Store;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    // Parallel data fetches
    const [inventoryRes, txRes, wasteRes, forecastRes, receivingRes] =
      await Promise.all([
        docClient.send(
          new QueryCommand({
            TableName: TABLES.INVENTORY,
            KeyConditionExpression: "storeId = :s",
            ExpressionAttributeValues: { ":s": storeId },
          })
        ),
        docClient.send(
          new QueryCommand({
            TableName: TABLES.TRANSACTIONS,
            IndexName: "timestamp-index",
            KeyConditionExpression: "storeId = :s AND #ts >= :since",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: { ":s": storeId, ":since": thirtyDaysAgo },
          })
        ),
        docClient.send(
          new QueryCommand({
            TableName: TABLES.WASTE_LOGS,
            IndexName: "storeId-timestamp-index",
            KeyConditionExpression: "storeId = :s AND #ts >= :since",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: { ":s": storeId, ":since": thirtyDaysAgo },
          })
        ),
        docClient.send(
          new QueryCommand({
            TableName: TABLES.FORECASTS,
            KeyConditionExpression: "forecastId = :fid",
            ExpressionAttributeValues: { ":fid": `latest-${storeId}` },
            Limit: 50,
          })
        ),
        docClient.send(
          new QueryCommand({
            TableName: TABLES.RECEIVING_LOGS,
            IndexName: "storeId-index",
            KeyConditionExpression: "storeId = :s",
            ExpressionAttributeValues: { ":s": storeId },
          })
        ),
      ]);

    const inventory = (inventoryRes.Items || []) as InventoryItem[];
    const transactions = (txRes.Items || []) as Transaction[];
    const wasteLogs = (wasteRes.Items || []) as WasteLog[];
    const forecasts = forecastRes.Items || [];

    // --- Food Cost Score ---
    const totalRevenue = transactions.reduce((s, tx) => s + tx.totalAmount, 0);
    const totalFoodCost = transactions.reduce((s, tx) => s + (tx.foodCost || 0), 0);
    const foodCostPercentage =
      totalRevenue > 0 ? Math.round((totalFoodCost / totalRevenue) * 10000) / 100 : 0;
    // Ideal: 25-30%. Score drops as it goes above 30%
    const foodCostScore = Math.max(
      0,
      Math.min(100, 100 - Math.max(0, foodCostPercentage - 25) * 3)
    );

    // --- Waste Score ---
    const totalWasteCost = wasteLogs.reduce((s, w) => s + w.totalCost, 0);
    const wastePercentage =
      totalFoodCost > 0
        ? Math.round((totalWasteCost / totalFoodCost) * 10000) / 100
        : 0;
    // Ideal: under 4%. Score drops at 10x rate
    const wasteScore = Math.max(0, Math.min(100, 100 - wastePercentage * 10));

    // --- Forecast Accuracy Score ---
    let forecastAccuracy = 0;
    if (forecasts.length > 0) {
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
    const forecastAccuracyScore = forecastAccuracy;

    // --- Inventory Turnover Score ---
    const totalInventoryValue = inventory.reduce(
      (s, i) => s + i.quantity * i.costPerUnit,
      0
    );
    // Turnover = COGS / avg inventory value. Higher is better for food.
    // Approximate days of inventory on hand
    const dailyCOGS = totalFoodCost / 30;
    const inventoryTurnoverDays =
      dailyCOGS > 0 ? Math.round(totalInventoryValue / dailyCOGS) : 0;
    // Ideal: 5-7 days of inventory. Score drops if too high (stale) or too low (stockouts)
    let inventoryTurnoverScore: number;
    if (inventoryTurnoverDays <= 3) {
      inventoryTurnoverScore = 60; // too lean
    } else if (inventoryTurnoverDays <= 7) {
      inventoryTurnoverScore = 100; // ideal
    } else if (inventoryTurnoverDays <= 14) {
      inventoryTurnoverScore = Math.max(50, 100 - (inventoryTurnoverDays - 7) * 7);
    } else {
      inventoryTurnoverScore = Math.max(0, 50 - (inventoryTurnoverDays - 14) * 3);
    }

    // --- Stockout Score ---
    const lowStockCount = inventory.filter(
      (i) => i.lowStockThreshold > 0 && i.quantity <= i.lowStockThreshold
    ).length;
    const zeroStockCount = inventory.filter(
      (i) => i.quantity <= 0
    ).length;
    const stockoutRate =
      inventory.length > 0
        ? Math.round((zeroStockCount / inventory.length) * 10000) / 100
        : 0;
    const stockoutScore =
      inventory.length > 0
        ? Math.max(0, 100 - (lowStockCount / inventory.length) * 200)
        : 100;

    // --- Overall Score (weighted) ---
    const overallScore = Math.round(
      foodCostScore * 0.3 +
        wasteScore * 0.25 +
        forecastAccuracyScore * 0.25 +
        inventoryTurnoverScore * 0.1 +
        stockoutScore * 0.1
    );

    // --- Recommendations ---
    const recommendations: string[] = [];

    if (foodCostPercentage > 35) {
      recommendations.push(
        `Food cost is ${foodCostPercentage}% — review portion sizes and supplier pricing to get below 30%`
      );
    } else if (foodCostPercentage > 30) {
      recommendations.push(
        `Food cost is ${foodCostPercentage}% — slightly above the 30% target. Check for portion creep`
      );
    }

    if (wastePercentage > 7) {
      const topWasteReason = wasteLogs.reduce(
        (acc, w) => {
          acc[w.reason] = (acc[w.reason] || 0) + w.totalCost;
          return acc;
        },
        {} as Record<string, number>
      );
      const topReason = Object.entries(topWasteReason).sort((a, b) => b[1] - a[1])[0];
      if (topReason) {
        recommendations.push(
          `Waste is ${wastePercentage}% of food cost — primary cause is "${topReason[0]}" ($${topReason[1].toFixed(2)}). Focus waste reduction efforts here`
        );
      }
    } else if (wastePercentage > 4) {
      recommendations.push(
        `Waste at ${wastePercentage}% — above the 4% industry benchmark. Review FIFO compliance`
      );
    }

    if (forecastAccuracy > 0 && forecastAccuracy < 80) {
      recommendations.push(
        `Forecast accuracy is ${forecastAccuracy}% — consider adjusting order quantities to match actual demand`
      );
    }

    if (inventoryTurnoverDays > 10) {
      recommendations.push(
        `Inventory sits ${inventoryTurnoverDays} days on average — order smaller quantities more frequently to reduce spoilage risk`
      );
    } else if (inventoryTurnoverDays <= 3 && inventoryTurnoverDays > 0) {
      recommendations.push(
        `Only ${inventoryTurnoverDays} days of inventory on hand — increase safety stock to prevent stockouts`
      );
    }

    if (zeroStockCount > 0) {
      recommendations.push(
        `${zeroStockCount} item${zeroStockCount > 1 ? "s" : ""} currently at zero stock — reorder immediately`
      );
    }

    const result: HealthScoreBreakdown = {
      storeId,
      storeName: store.name,
      overallScore,
      status: scoreStatus(overallScore),
      components: {
        foodCostScore: Math.round(foodCostScore),
        wasteScore: Math.round(wasteScore),
        forecastAccuracyScore: Math.round(forecastAccuracyScore),
        inventoryTurnoverScore: Math.round(inventoryTurnoverScore),
        stockoutScore: Math.round(stockoutScore),
      },
      details: {
        foodCostPercentage,
        wastePercentage,
        forecastAccuracy,
        inventoryTurnoverDays,
        stockoutRate,
      },
      recommendations,
      generatedAt: new Date().toISOString(),
    };

    return success(result);
  } catch (err) {
    console.error("GetHealthScore error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
