import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { WasteLog } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface IngredientWaste {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  totalQuantity: number;
  totalCost: number;
  entryCount: number;
  byReason: Record<string, { quantity: number; cost: number }>;
}

interface TrendPoint {
  week: string;
  totalCost: number;
  totalQuantity: number;
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

    // Default to last 30 days
    const days = parseInt(event.queryStringParameters?.days || "30", 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Fetch waste logs for this store in the period
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.WASTE_LOGS,
        IndexName: "storeId-timestamp-index",
        KeyConditionExpression: "storeId = :storeId AND #ts >= :since",
        ExpressionAttributeNames: { "#ts": "timestamp" },
        ExpressionAttributeValues: {
          ":storeId": storeId,
          ":since": since,
        },
        ScanIndexForward: false,
      })
    );

    const logs = (result.Items || []) as WasteLog[];

    // Fetch receiving logs to calculate waste as % of purchases
    const receivingResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.RECEIVING_LOGS,
        IndexName: "storeId-index",
        KeyConditionExpression: "storeId = :storeId",
        ExpressionAttributeValues: { ":storeId": storeId },
      })
    );

    const totalPurchaseCost = (receivingResult.Items || []).reduce(
      (sum, rl) => {
        const items = (rl.itemsScanned || []) as { quantity: number; unitCost: number }[];
        return sum + items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
      },
      0
    );

    // Aggregate waste by ingredient
    const byIngredient = new Map<string, IngredientWaste>();

    for (const log of logs) {
      let entry = byIngredient.get(log.ingredientId);
      if (!entry) {
        entry = {
          ingredientId: log.ingredientId,
          ingredientName: log.ingredientName,
          unit: log.unit,
          totalQuantity: 0,
          totalCost: 0,
          entryCount: 0,
          byReason: {},
        };
        byIngredient.set(log.ingredientId, entry);
      }

      entry.totalQuantity += log.quantity;
      entry.totalCost += log.totalCost;
      entry.entryCount += 1;

      if (!entry.byReason[log.reason]) {
        entry.byReason[log.reason] = { quantity: 0, cost: 0 };
      }
      entry.byReason[log.reason].quantity += log.quantity;
      entry.byReason[log.reason].cost += log.totalCost;
    }

    const ingredientWaste = Array.from(byIngredient.values())
      .map((iw) => ({
        ...iw,
        totalQuantity: Math.round(iw.totalQuantity * 100) / 100,
        totalCost: Math.round(iw.totalCost * 100) / 100,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    // Total waste cost
    const totalWasteCost = logs.reduce((sum, l) => sum + l.totalCost, 0);
    const wasteAsPercentOfPurchases =
      totalPurchaseCost > 0
        ? Math.round((totalWasteCost / totalPurchaseCost) * 10000) / 100
        : 0;

    // Anomaly detection: flag ingredients with waste >50% above average
    const avgWasteCost =
      ingredientWaste.length > 0
        ? totalWasteCost / ingredientWaste.length
        : 0;
    const anomalyThreshold = avgWasteCost * 1.5;

    const anomalies = ingredientWaste
      .filter((iw) => iw.totalCost > anomalyThreshold && avgWasteCost > 0)
      .map((iw) => ({
        ingredientId: iw.ingredientId,
        ingredientName: iw.ingredientName,
        wasteCost: iw.totalCost,
        storeAverage: Math.round(avgWasteCost * 100) / 100,
        percentAboveAverage: Math.round(
          ((iw.totalCost - avgWasteCost) / avgWasteCost) * 100
        ),
        topReason: Object.entries(iw.byReason).sort(
          (a, b) => b[1].cost - a[1].cost
        )[0]?.[0],
      }));

    // Trend analysis: group by week
    const weeklyMap = new Map<string, { cost: number; quantity: number }>();
    for (const log of logs) {
      const d = new Date(log.timestamp);
      // Get Monday of the week
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));
      const weekKey = monday.toISOString().split("T")[0];

      const existing = weeklyMap.get(weekKey);
      if (existing) {
        existing.cost += log.totalCost;
        existing.quantity += log.quantity;
      } else {
        weeklyMap.set(weekKey, { cost: log.totalCost, quantity: log.quantity });
      }
    }

    const trend: TrendPoint[] = Array.from(weeklyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, data]) => ({
        week,
        totalCost: Math.round(data.cost * 100) / 100,
        totalQuantity: Math.round(data.quantity * 100) / 100,
      }));

    // Determine if waste is trending up or down
    let trendDirection: "improving" | "worsening" | "stable" | "insufficient_data" =
      "insufficient_data";
    if (trend.length >= 3) {
      const recentHalf = trend.slice(Math.floor(trend.length / 2));
      const olderHalf = trend.slice(0, Math.floor(trend.length / 2));
      const recentAvg =
        recentHalf.reduce((s, t) => s + t.totalCost, 0) / recentHalf.length;
      const olderAvg =
        olderHalf.reduce((s, t) => s + t.totalCost, 0) / olderHalf.length;

      const change = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;
      if (change > 0.1) trendDirection = "worsening";
      else if (change < -0.1) trendDirection = "improving";
      else trendDirection = "stable";
    }

    // Generate recommendations
    const recommendations: string[] = [];

    // Recommend based on top wasted ingredients
    for (const iw of ingredientWaste.slice(0, 3)) {
      const topReason = Object.entries(iw.byReason).sort(
        (a, b) => b[1].cost - a[1].cost
      )[0];

      if (topReason) {
        const [reason, data] = topReason;
        const pctOfTotal =
          iw.totalCost > 0
            ? Math.round((data.cost / iw.totalCost) * 100)
            : 0;

        if (reason === "over-prep") {
          // Analyze which days have the most waste for this ingredient
          const dayMap = new Map<number, number>();
          for (const log of logs) {
            if (log.ingredientId === iw.ingredientId && log.reason === "over-prep") {
              const dayOfWeek = new Date(log.timestamp).getDay();
              dayMap.set(dayOfWeek, (dayMap.get(dayOfWeek) || 0) + log.quantity);
            }
          }
          const worstDay = Array.from(dayMap.entries()).sort(
            (a, b) => b[1] - a[1]
          )[0];
          if (worstDay) {
            const dayNames = [
              "Sundays",
              "Mondays",
              "Tuesdays",
              "Wednesdays",
              "Thursdays",
              "Fridays",
              "Saturdays",
            ];
            recommendations.push(
              `Reduce ${iw.ingredientName} prep on ${dayNames[worstDay[0]]} - ${pctOfTotal}% of its waste is from over-prep`
            );
          }
        } else if (reason === "expired") {
          recommendations.push(
            `Review ordering frequency for ${iw.ingredientName} - ${pctOfTotal}% of waste ($${data.cost.toFixed(2)}) is from expiration`
          );
        } else if (reason === "damaged") {
          recommendations.push(
            `Check storage/handling for ${iw.ingredientName} - ${pctOfTotal}% of waste is from damage`
          );
        } else {
          recommendations.push(
            `Investigate ${iw.ingredientName} waste ($${iw.totalCost.toFixed(2)} over ${days} days) - top cause: ${reason}`
          );
        }
      }
    }

    if (wasteAsPercentOfPurchases > 5) {
      recommendations.push(
        `Overall waste is ${wasteAsPercentOfPurchases}% of purchases - industry target is under 4%`
      );
    }

    if (trendDirection === "worsening") {
      recommendations.push(
        "Waste costs are trending upward - consider a team meeting to review prep procedures"
      );
    }

    return success({
      storeId,
      period: { days, since },
      totals: {
        wasteCost: Math.round(totalWasteCost * 100) / 100,
        wasteEntries: logs.length,
        purchaseCost: Math.round(totalPurchaseCost * 100) / 100,
        wasteAsPercentOfPurchases,
      },
      byIngredient: ingredientWaste,
      anomalies,
      trend,
      trendDirection,
      recommendations,
    });
  } catch (err) {
    console.error("GetWasteAnalytics error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
