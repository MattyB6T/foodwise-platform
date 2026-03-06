import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  StoreComparison,
  StoreComparisonMetric,
  ComparisonInsight,
  WasteLog,
} from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";
import { getAllStores, getStoreSnapshot } from "../utils/storeMetrics";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const stores = await getAllStores();
    if (stores.length < 2) {
      return error("Need at least 2 stores for comparison", 400, "INSUFFICIENT_STORES");
    }

    const snapshots = await Promise.all(stores.map(getStoreSnapshot));

    const makeMetric = (
      key: "foodCostPercentage" | "wastePercentage" | "healthScore" | "salesLast30d" | "forecastAccuracy"
    ): StoreComparisonMetric[] =>
      snapshots.map((s) => ({
        storeId: s.storeId,
        storeName: s.storeName,
        value: s[key],
      }));

    // Generate AI insights
    const insights: ComparisonInsight[] = [];

    // Compare food cost across stores
    const avgFoodCost =
      snapshots.reduce((s, snap) => s + snap.foodCostPercentage, 0) /
      snapshots.length;

    for (const snap of snapshots) {
      if (snap.foodCostPercentage > avgFoodCost * 1.15) {
        insights.push({
          type: "warning",
          message: `${snap.storeName} food cost is ${snap.foodCostPercentage}% — ${Math.round(((snap.foodCostPercentage - avgFoodCost) / avgFoodCost) * 100)}% higher than your average of ${Math.round(avgFoodCost * 10) / 10}%`,
        });
      }
    }

    // Compare waste across stores, broken down by ingredient
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Fetch waste by ingredient per store
    const wasteByStore = new Map<
      string,
      Map<string, { name: string; cost: number }>
    >();

    for (const store of stores) {
      const wasteRes = await docClient.send(
        new QueryCommand({
          TableName: TABLES.WASTE_LOGS,
          IndexName: "storeId-timestamp-index",
          KeyConditionExpression: "storeId = :s AND #ts >= :since",
          ExpressionAttributeNames: { "#ts": "timestamp" },
          ExpressionAttributeValues: {
            ":s": store.storeId,
            ":since": thirtyDaysAgo,
          },
        })
      );

      const ingredientMap = new Map<string, { name: string; cost: number }>();
      for (const item of (wasteRes.Items || []) as WasteLog[]) {
        const existing = ingredientMap.get(item.ingredientId);
        if (existing) {
          existing.cost += item.totalCost;
        } else {
          ingredientMap.set(item.ingredientId, {
            name: item.ingredientName,
            cost: item.totalCost,
          });
        }
      }
      wasteByStore.set(store.storeId, ingredientMap);
    }

    // Find ingredients where one store wastes significantly more
    const allIngredientIds = new Set<string>();
    for (const ingredientMap of wasteByStore.values()) {
      for (const id of ingredientMap.keys()) allIngredientIds.add(id);
    }

    for (const ingredientId of allIngredientIds) {
      const costs: { storeId: string; storeName: string; cost: number }[] = [];
      for (const snap of snapshots) {
        const ingredientMap = wasteByStore.get(snap.storeId);
        const entry = ingredientMap?.get(ingredientId);
        if (entry) {
          costs.push({
            storeId: snap.storeId,
            storeName: snap.storeName,
            cost: entry.cost,
          });
        }
      }

      if (costs.length >= 2) {
        const avg = costs.reduce((s, c) => s + c.cost, 0) / costs.length;
        for (const c of costs) {
          if (avg > 0 && c.cost > avg * 1.4) {
            const ingredientName =
              wasteByStore.get(c.storeId)?.get(ingredientId)?.name || ingredientId;
            insights.push({
              type: "warning",
              message: `${c.storeName} has ${Math.round(((c.cost - avg) / avg) * 100)}% higher ${ingredientName} waste than your other stores`,
            });
          }
        }
      }
    }

    // Forecast accuracy insights
    const bestForecast = snapshots.reduce((best, s) =>
      s.forecastAccuracy > best.forecastAccuracy ? s : best
    );
    const worstForecast = snapshots.reduce((worst, s) =>
      s.forecastAccuracy < worst.forecastAccuracy ? s : worst
    );

    if (
      bestForecast.forecastAccuracy > 0 &&
      bestForecast.forecastAccuracy - worstForecast.forecastAccuracy > 10
    ) {
      insights.push({
        type: "suggestion",
        message: `${bestForecast.storeName}'s forecast accuracy is ${bestForecast.forecastAccuracy}% — replicate their ordering process across all locations`,
      });
    }

    // Health score insights
    const bestHealth = snapshots.reduce((best, s) =>
      s.healthScore > best.healthScore ? s : best
    );
    if (bestHealth.healthScore >= 80) {
      insights.push({
        type: "positive",
        message: `${bestHealth.storeName} is your top performer with a health score of ${bestHealth.healthScore}/100`,
      });
    }

    // Sales trend insights
    const declining = snapshots.filter((s) => s.salesTrend === "down");
    if (declining.length > 0) {
      insights.push({
        type: "warning",
        message: `${declining.map((s) => s.storeName).join(", ")} ${declining.length === 1 ? "has" : "have"} declining sales over the last 30 days`,
      });
    }

    const comparison: StoreComparison = {
      metrics: {
        foodCostPercentage: makeMetric("foodCostPercentage"),
        wastePercentage: makeMetric("wastePercentage"),
        healthScore: makeMetric("healthScore"),
        salesLast30d: makeMetric("salesLast30d"),
        forecastAccuracy: makeMetric("forecastAccuracy"),
      },
      insights,
      generatedAt: new Date().toISOString(),
    };

    return success(comparison);
  } catch (err) {
    console.error("GetStoreComparison error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
