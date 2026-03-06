import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { InventoryItem, Transaction, WasteLog, DashboardMetrics } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event); // ensure authenticated

    const storeId = event.pathParameters?.storeId;
    if (!storeId) {
      return error("storeId is required", 400);
    }

    // Fetch all inventory items for the store
    const inventoryResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.INVENTORY,
        KeyConditionExpression: "storeId = :storeId",
        ExpressionAttributeValues: { ":storeId": storeId },
      })
    );
    const inventoryItems = (inventoryResult.Items || []) as InventoryItem[];

    // Fetch recent transactions (last 30 days) using the GSI
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const transactionsResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.TRANSACTIONS,
        IndexName: "timestamp-index",
        KeyConditionExpression:
          "storeId = :storeId AND #ts >= :since",
        ExpressionAttributeNames: { "#ts": "timestamp" },
        ExpressionAttributeValues: {
          ":storeId": storeId,
          ":since": thirtyDaysAgo,
        },
      })
    );
    const transactions = (transactionsResult.Items || []) as Transaction[];

    // Calculate inventory summary
    const totalItems = inventoryItems.length;
    const totalValue = inventoryItems.reduce(
      (sum, item) => sum + item.quantity * item.costPerUnit,
      0
    );

    // Calculate food cost percentage using stored food cost from each transaction
    const totalRevenue = transactions.reduce(
      (sum, tx) => sum + tx.totalAmount,
      0
    );
    const totalFoodCost = transactions.reduce(
      (sum, tx) => sum + (tx.foodCost || 0),
      0
    );
    const foodCostPercentage =
      totalRevenue > 0
        ? Math.round((totalFoodCost / totalRevenue) * 10000) / 100
        : 0;

    // Fetch waste logs for last 30 days
    const wasteResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.WASTE_LOGS,
        IndexName: "storeId-timestamp-index",
        KeyConditionExpression: "storeId = :storeId AND #ts >= :since",
        ExpressionAttributeNames: { "#ts": "timestamp" },
        ExpressionAttributeValues: {
          ":storeId": storeId,
          ":since": thirtyDaysAgo,
        },
      })
    );
    const wasteLogs = (wasteResult.Items || []) as WasteLog[];

    const wasteTotal = wasteLogs.reduce((sum, w) => sum + w.totalCost, 0);

    // Aggregate waste by reason
    const reasonMap = new Map<string, number>();
    const ingredientMap = new Map<string, { name: string; cost: number }>();
    for (const w of wasteLogs) {
      reasonMap.set(w.reason, (reasonMap.get(w.reason) || 0) + w.totalCost);
      const existing = ingredientMap.get(w.ingredientId);
      if (existing) {
        existing.cost += w.totalCost;
      } else {
        ingredientMap.set(w.ingredientId, {
          name: w.ingredientName,
          cost: w.totalCost,
        });
      }
    }

    const topReasons = Array.from(reasonMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([reason, cost]) => ({ reason, cost: Math.round(cost * 100) / 100 }));

    const topIngredients = Array.from(ingredientMap.values())
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5)
      .map((i) => ({
        ingredientName: i.name,
        cost: Math.round(i.cost * 100) / 100,
      }));

    const waste30d = {
      totalCost: Math.round(wasteTotal * 100) / 100,
      totalEntries: wasteLogs.length,
      topReasons,
      topIngredients,
    };

    // Low stock alerts
    const lowStockAlerts = inventoryItems
      .filter(
        (item) => item.lowStockThreshold > 0 && item.quantity <= item.lowStockThreshold
      )
      .map((item) => ({
        itemId: item.itemId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        threshold: item.lowStockThreshold,
      }));

    const metrics: DashboardMetrics = {
      storeId,
      inventorySummary: { totalItems, totalValue },
      foodCostPercentage,
      wasteTotal: Math.round(wasteTotal * 100) / 100,
      waste30d,
      lowStockAlerts,
      generatedAt: new Date().toISOString(),
    };

    return success(metrics);
  } catch (err) {
    console.error("GetDashboard error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
