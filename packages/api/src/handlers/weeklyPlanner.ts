import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { Transaction, WasteLog, Store } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { requireRole, isErrorResult } from "../utils/roles";

const bedrock = new BedrockRuntimeClient({});
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-20250514-v1:0";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DayPattern {
  dayOfWeek: number;
  dayName: string;
  avgTransactions: number;
  avgRevenue: number;
  avgFoodCost: number;
  avgLaborHours: number;
  avgLaborCost: number;
  avgWasteCost: number;
  dataPoints: number;
}

interface WeeklyPlan {
  storeId: string;
  storeName: string;
  weekStarting: string;
  bufferPercentage: number;
  dayPlans: DayPlan[];
  weekTotals: {
    projectedRevenue: number;
    projectedFoodCost: number;
    projectedLaborCost: number;
    projectedWasteCost: number;
    projectedProfit: number;
    profitMargin: number;
    recommendedTotalStaffHours: number;
  };
  orderRecommendations: OrderRecommendation[];
  wasteAlerts: string[];
  aiInsights?: string;
  dataQuality: {
    weeksOfData: number;
    confidence: "high" | "medium" | "low";
    message: string;
  };
  generatedAt: string;
}

interface DayPlan {
  date: string;
  dayName: string;
  projectedRevenue: number;
  projectedTransactions: number;
  recommendedStaffCount: number;
  recommendedStaffHours: number;
  projectedLaborCost: number;
  projectedFoodCost: number;
  confidence: "high" | "medium" | "low";
}

interface OrderRecommendation {
  ingredientName: string;
  currentStock: number;
  unit: string;
  projectedUsage: number;
  recommendedOrder: number;
  bufferAmount: number;
  urgency: "order-now" | "order-soon" | "adequate";
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const auth = requireRole(event, "manager");
    if (isErrorResult(auth)) return auth;

    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);

    // Get buffer preference from query or store settings (default 15%)
    const bufferParam = event.queryStringParameters?.buffer;
    const bufferPercentage = bufferParam ? Math.min(50, Math.max(0, parseInt(bufferParam))) : 15;

    // Determine how far back to look (up to 180 days, default 90)
    const lookbackDays = Math.min(365, parseInt(event.queryStringParameters?.lookback || "90"));
    const lookbackDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all data in parallel
    const [storeRes, txRes, wasteRes, staffRes, timeClockRes, inventoryRes, forecastRes] =
      await Promise.all([
        docClient.send(new GetCommand({ TableName: TABLES.STORES, Key: { storeId } })),
        docClient.send(
          new QueryCommand({
            TableName: TABLES.TRANSACTIONS,
            IndexName: "timestamp-index",
            KeyConditionExpression: "storeId = :s AND #ts >= :since",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: { ":s": storeId, ":since": lookbackDate },
          })
        ),
        docClient.send(
          new QueryCommand({
            TableName: TABLES.WASTE_LOGS,
            IndexName: "storeId-timestamp-index",
            KeyConditionExpression: "storeId = :s AND #ts >= :since",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: { ":s": storeId, ":since": lookbackDate },
          })
        ),
        docClient.send(
          new QueryCommand({
            TableName: TABLES.STAFF,
            IndexName: "storeId-index",
            KeyConditionExpression: "storeId = :s",
            ExpressionAttributeValues: { ":s": storeId },
          })
        ),
        docClient.send(
          new QueryCommand({
            TableName: TABLES.TIME_CLOCK,
            IndexName: "storeId-clockInTime-index",
            KeyConditionExpression: "storeId = :s AND clockInTime >= :since",
            ExpressionAttributeValues: { ":s": storeId, ":since": lookbackDate },
          })
        ),
        docClient.send(
          new QueryCommand({
            TableName: TABLES.INVENTORY,
            KeyConditionExpression: "storeId = :s",
            ExpressionAttributeValues: { ":s": storeId },
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
      ]);

    if (!storeRes.Item) return error("Store not found", 404);
    const store = storeRes.Item as Store;

    const transactions = (txRes.Items || []) as Transaction[];
    const wasteLogs = (wasteRes.Items || []) as WasteLog[];
    const staffItems = staffRes.Items || [];
    const timeEntries = timeClockRes.Items || [];
    const inventory = inventoryRes.Items || [];
    const forecasts = forecastRes.Items || [];

    // Build hourly rate map
    const rateMap: Record<string, number> = {};
    for (const s of staffItems) {
      if (s.hourlyRate) rateMap[s.staffId] = s.hourlyRate;
    }
    const avgHourlyRate = Object.values(rateMap).length > 0
      ? Object.values(rateMap).reduce((a, b) => a + b, 0) / Object.values(rateMap).length
      : 12; // fallback

    // --- Analyze historical patterns by day of week ---
    const dayBuckets: Record<number, { transactions: number[]; revenue: number[]; foodCost: number[]; wasteCost: number[] }> = {};
    for (let d = 0; d < 7; d++) {
      dayBuckets[d] = { transactions: [], revenue: [], foodCost: [], wasteCost: [] };
    }

    // Group transactions by date
    const txByDate: Record<string, Transaction[]> = {};
    for (const tx of transactions) {
      const date = tx.timestamp.split("T")[0];
      if (!txByDate[date]) txByDate[date] = [];
      txByDate[date].push(tx);
    }

    // Aggregate per-date into day-of-week buckets
    for (const [dateStr, txs] of Object.entries(txByDate)) {
      const dow = new Date(dateStr + "T12:00:00Z").getUTCDay();
      const revenue = txs.reduce((s, tx) => s + tx.totalAmount, 0);
      const foodCost = txs.reduce((s, tx) => s + (tx.foodCost || 0), 0);
      dayBuckets[dow].transactions.push(txs.length);
      dayBuckets[dow].revenue.push(revenue);
      dayBuckets[dow].foodCost.push(foodCost);
    }

    // Group waste by date then day of week
    const wasteByDate: Record<string, number> = {};
    for (const w of wasteLogs) {
      const date = w.timestamp.split("T")[0];
      wasteByDate[date] = (wasteByDate[date] || 0) + w.totalCost;
    }
    for (const [dateStr, cost] of Object.entries(wasteByDate)) {
      const dow = new Date(dateStr + "T12:00:00Z").getUTCDay();
      dayBuckets[dow].wasteCost.push(cost);
    }

    // Group labor hours by date then day of week
    const laborByDate: Record<string, { hours: number; cost: number }> = {};
    for (const e of timeEntries) {
      if (!e.clockInTime || !e.totalHours) continue;
      const date = e.clockInTime.split("T")[0];
      if (!laborByDate[date]) laborByDate[date] = { hours: 0, cost: 0 };
      laborByDate[date].hours += e.totalHours || 0;
      laborByDate[date].cost += (e.totalHours || 0) * (rateMap[e.staffId] || avgHourlyRate);
    }

    const laborDayBuckets: Record<number, { hours: number[]; cost: number[] }> = {};
    for (let d = 0; d < 7; d++) laborDayBuckets[d] = { hours: [], cost: [] };
    for (const [dateStr, data] of Object.entries(laborByDate)) {
      const dow = new Date(dateStr + "T12:00:00Z").getUTCDay();
      laborDayBuckets[dow].hours.push(data.hours);
      laborDayBuckets[dow].cost.push(data.cost);
    }

    // Calculate day-of-week patterns
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const dayPatterns: DayPattern[] = [];
    for (let d = 0; d < 7; d++) {
      dayPatterns.push({
        dayOfWeek: d,
        dayName: DAY_NAMES[d],
        avgTransactions: Math.round(avg(dayBuckets[d].transactions)),
        avgRevenue: Math.round(avg(dayBuckets[d].revenue) * 100) / 100,
        avgFoodCost: Math.round(avg(dayBuckets[d].foodCost) * 100) / 100,
        avgLaborHours: Math.round(avg(laborDayBuckets[d].hours) * 10) / 10,
        avgLaborCost: Math.round(avg(laborDayBuckets[d].cost) * 100) / 100,
        avgWasteCost: Math.round(avg(dayBuckets[d].wasteCost) * 100) / 100,
        dataPoints: dayBuckets[d].transactions.length,
      });
    }

    // --- Recent trend weighting ---
    // Compare last 30 days to overall average to detect if business is trending up/down
    const recentTxs = transactions.filter((tx) => tx.timestamp >= thirtyDaysAgo);
    const recentDailyRevenue = recentTxs.length > 0
      ? recentTxs.reduce((s, tx) => s + tx.totalAmount, 0) / 30
      : 0;
    const overallDailyRevenue = transactions.length > 0
      ? transactions.reduce((s, tx) => s + tx.totalAmount, 0) / lookbackDays
      : 0;
    const trendMultiplier = overallDailyRevenue > 0
      ? Math.min(1.5, Math.max(0.5, recentDailyRevenue / overallDailyRevenue))
      : 1;

    // --- Generate next week's day plans ---
    const today = new Date();
    // Find next Monday
    const daysUntilMonday = (8 - today.getUTCDay()) % 7 || 7;
    const nextMonday = new Date(today);
    nextMonday.setUTCDate(today.getUTCDate() + daysUntilMonday);
    nextMonday.setUTCHours(0, 0, 0, 0);

    const dayPlans: DayPlan[] = [];
    let weekTotalRevenue = 0;
    let weekTotalFoodCost = 0;
    let weekTotalLaborCost = 0;
    let weekTotalWaste = 0;
    let weekTotalStaffHours = 0;

    for (let i = 0; i < 7; i++) {
      const planDate = new Date(nextMonday);
      planDate.setUTCDate(nextMonday.getUTCDate() + i);
      const dow = planDate.getUTCDay();
      const pattern = dayPatterns[dow];

      // Apply trend multiplier and buffer
      const projectedRevenue = Math.round(pattern.avgRevenue * trendMultiplier * 100) / 100;
      const projectedTransactions = Math.round(pattern.avgTransactions * trendMultiplier);
      const projectedFoodCost = Math.round(pattern.avgFoodCost * trendMultiplier * 100) / 100;

      // Staffing: revenue-per-labor-hour target
      // Industry standard: ~$40-60 revenue per labor hour for fast casual
      const revenuePerLaborHour = pattern.avgLaborHours > 0 && pattern.avgRevenue > 0
        ? pattern.avgRevenue / pattern.avgLaborHours
        : 45; // default target
      const baseStaffHours = projectedRevenue > 0
        ? projectedRevenue / revenuePerLaborHour
        : pattern.avgLaborHours;
      // Staffing buffer: round up to nearest whole person, enforce minimum viable crew (2)
      // Don't just add a flat %, round to whole humans and ensure coverage
      const baseStaffCount = Math.max(2, Math.ceil(baseStaffHours / 8));
      const recommendedStaffCount = Math.max(2, Math.ceil(baseStaffCount * (1 + bufferPercentage / 100)));
      const bufferedStaffHours = Math.round(recommendedStaffCount * 8 * 10) / 10;

      const projectedLaborCost = Math.round(bufferedStaffHours * avgHourlyRate * 100) / 100;
      const projectedWaste = Math.round(pattern.avgWasteCost * trendMultiplier * 100) / 100;

      // Confidence based on data points
      const confidence: "high" | "medium" | "low" =
        pattern.dataPoints >= 8 ? "high" : pattern.dataPoints >= 4 ? "medium" : "low";

      dayPlans.push({
        date: planDate.toISOString().split("T")[0],
        dayName: DAY_NAMES[dow],
        projectedRevenue,
        projectedTransactions,
        recommendedStaffCount,
        recommendedStaffHours: bufferedStaffHours,
        projectedLaborCost,
        projectedFoodCost,
        confidence,
      });

      weekTotalRevenue += projectedRevenue;
      weekTotalFoodCost += projectedFoodCost;
      weekTotalLaborCost += projectedLaborCost;
      weekTotalWaste += projectedWaste;
      weekTotalStaffHours += bufferedStaffHours;
    }

    const projectedProfit = Math.round((weekTotalRevenue - weekTotalFoodCost - weekTotalLaborCost - weekTotalWaste) * 100) / 100;
    const profitMargin = weekTotalRevenue > 0
      ? Math.round((projectedProfit / weekTotalRevenue) * 10000) / 100
      : 0;

    // --- Order recommendations based on projected usage ---
    const orderRecommendations: OrderRecommendation[] = [];

    // Calculate average daily ingredient usage from recent transactions
    const recentDays = Math.max(1, Math.round(
      (Date.now() - new Date(thirtyDaysAgo).getTime()) / (24 * 60 * 60 * 1000)
    ));

    for (const item of inventory) {
      const currentStock = item.quantity || 0;
      // Estimate weekly usage: current daily burn rate * 7, adjusted by trend
      const dailyBurnRate = item.costPerUnit > 0 && item.lowStockThreshold > 0
        ? (item.lowStockThreshold * 2) / 7 // rough estimate based on threshold
        : currentStock / 14; // assume 2-week turnover
      const weeklyUsage = Math.round(dailyBurnRate * 7 * trendMultiplier * 100) / 100;
      const bufferedUsage = weeklyUsage * (1 + bufferPercentage / 100);
      const gap = bufferedUsage - currentStock;

      if (gap > 0 || currentStock <= (item.lowStockThreshold || 0)) {
        orderRecommendations.push({
          ingredientName: item.name,
          currentStock: Math.round(currentStock * 100) / 100,
          unit: item.unit,
          projectedUsage: weeklyUsage,
          recommendedOrder: Math.round(Math.max(gap, 0) * 100) / 100,
          bufferAmount: Math.round((bufferedUsage - weeklyUsage) * 100) / 100,
          urgency: currentStock <= 0 ? "order-now"
            : currentStock <= (item.lowStockThreshold || 0) ? "order-now"
            : gap > 0 ? "order-soon"
            : "adequate",
        });
      }
    }

    // Sort by urgency
    const urgencyOrder = { "order-now": 0, "order-soon": 1, "adequate": 2 };
    orderRecommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    // --- Waste alerts ---
    const wasteAlerts: string[] = [];

    // Find day-of-week waste patterns
    for (const pattern of dayPatterns) {
      if (pattern.avgWasteCost > 0 && pattern.avgRevenue > 0) {
        const wastePercent = (pattern.avgWasteCost / pattern.avgRevenue) * 100;
        if (wastePercent > 5) {
          wasteAlerts.push(
            `${pattern.dayName}s average ${wastePercent.toFixed(1)}% waste rate ($${pattern.avgWasteCost.toFixed(2)}) — reduce ${pattern.dayName} prep quantities`
          );
        }
      }
    }

    // Find ingredient-specific waste patterns from recent data
    const recentWaste = wasteLogs.filter((w) => w.timestamp >= thirtyDaysAgo);
    const wasteByIngredient = new Map<string, { name: string; cost: number; reason: string; count: number }>();
    for (const w of recentWaste) {
      const key = w.ingredientId;
      const existing = wasteByIngredient.get(key);
      if (existing) {
        existing.cost += w.totalCost;
        existing.count++;
      } else {
        wasteByIngredient.set(key, { name: w.ingredientName, cost: w.totalCost, reason: w.reason, count: 1 });
      }
    }

    const topWasteItems = Array.from(wasteByIngredient.values())
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3);

    for (const item of topWasteItems) {
      if (item.cost > 20) {
        wasteAlerts.push(
          `${item.name}: $${item.cost.toFixed(2)} wasted in 30 days (${item.count} events, primary cause: ${item.reason}) — consider reducing order quantity`
        );
      }
    }

    // --- AI Insights (optional, uses Bedrock) ---
    let aiInsights: string | undefined;
    const useAi = event.queryStringParameters?.insights !== "false";

    if (useAi) {
      try {
        const prompt = buildPlannerPrompt(store, dayPatterns, dayPlans, orderRecommendations, wasteAlerts, trendMultiplier, bufferPercentage, weekTotalRevenue, weekTotalFoodCost, weekTotalLaborCost);

        const response = await bedrock.send(
          new InvokeModelCommand({
            modelId: MODEL_ID,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
              anthropic_version: "bedrock-2023-05-31",
              max_tokens: 800,
              messages: [{ role: "user", content: prompt }],
            }),
          })
        );

        const responseBody = JSON.parse(new TextDecoder().decode(response.body));
        aiInsights = responseBody.content?.[0]?.text;
      } catch (aiErr) {
        console.warn("AI insights generation failed, returning plan without insights:", aiErr);
        // Plan still works without AI — just no narrative insights
      }
    }

    // Data quality assessment
    const maxDataPoints = Math.max(...dayPatterns.map((p) => p.dataPoints));
    const dataQuality: WeeklyPlan["dataQuality"] = maxDataPoints >= 12
      ? { weeksOfData: maxDataPoints, confidence: "high", message: `Based on ${maxDataPoints}+ weeks of historical data` }
      : maxDataPoints >= 6
      ? { weeksOfData: maxDataPoints, confidence: "medium", message: `Based on ${maxDataPoints} weeks of data — recommendations will improve with more history` }
      : { weeksOfData: maxDataPoints, confidence: "low", message: `Only ${maxDataPoints} week${maxDataPoints !== 1 ? "s" : ""} of data available — treat recommendations as rough estimates` };

    const plan: WeeklyPlan = {
      storeId,
      storeName: store.name,
      weekStarting: nextMonday.toISOString().split("T")[0],
      bufferPercentage,
      dayPlans,
      weekTotals: {
        projectedRevenue: Math.round(weekTotalRevenue * 100) / 100,
        projectedFoodCost: Math.round(weekTotalFoodCost * 100) / 100,
        projectedLaborCost: Math.round(weekTotalLaborCost * 100) / 100,
        projectedWasteCost: Math.round(weekTotalWaste * 100) / 100,
        projectedProfit,
        profitMargin,
        recommendedTotalStaffHours: Math.round(weekTotalStaffHours * 10) / 10,
      },
      orderRecommendations: orderRecommendations.slice(0, 15),
      wasteAlerts,
      aiInsights,
      dataQuality,
      generatedAt: new Date().toISOString(),
    };

    return success(plan);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("WeeklyPlanner error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};

function buildPlannerPrompt(
  store: Store,
  patterns: DayPattern[],
  dayPlans: DayPlan[],
  orders: OrderRecommendation[],
  wasteAlerts: string[],
  trendMultiplier: number,
  buffer: number,
  weekRevenue: number,
  weekFoodCost: number,
  weekLaborCost: number,
): string {
  const trendDirection = trendMultiplier > 1.05 ? "trending UP" : trendMultiplier < 0.95 ? "trending DOWN" : "stable";
  const foodCostPct = weekRevenue > 0 ? ((weekFoodCost / weekRevenue) * 100).toFixed(1) : "N/A";
  const laborCostPct = weekRevenue > 0 ? ((weekLaborCost / weekRevenue) * 100).toFixed(1) : "N/A";

  return `You are an AI operations advisor for ${store.name}, a food service restaurant.
Analyze this week's plan and give 3-5 brief, actionable insights. Focus on cost savings, staffing optimization, and waste reduction. Be specific with numbers.

## Historical Patterns (by day of week)
${patterns.map((p) => `${p.dayName}: avg $${p.avgRevenue.toFixed(0)} revenue, ${p.avgTransactions} txns, ${p.avgLaborHours}h labor, $${p.avgWasteCost.toFixed(0)} waste (${p.dataPoints} weeks of data)`).join("\n")}

## Recent Trend
Sales are ${trendDirection} (${((trendMultiplier - 1) * 100).toFixed(0)}% vs historical average)

## Next Week's Plan (${buffer}% safety buffer)
${dayPlans.map((d) => `${d.dayName} ${d.date}: $${d.projectedRevenue.toFixed(0)} projected, ${d.recommendedStaffCount} staff (${d.recommendedStaffHours}h), confidence: ${d.confidence}`).join("\n")}

## Week Totals
- Projected revenue: $${weekRevenue.toFixed(0)}
- Food cost: $${weekFoodCost.toFixed(0)} (${foodCostPct}%)
- Labor cost: $${weekLaborCost.toFixed(0)} (${laborCostPct}%)

## Items Needing Orders
${orders.filter((o) => o.urgency !== "adequate").slice(0, 8).map((o) => `- ${o.ingredientName}: ${o.currentStock} ${o.unit} on hand, need ${o.recommendedOrder} ${o.unit} (${o.urgency})`).join("\n") || "All items adequately stocked"}

## Waste Concerns
${wasteAlerts.join("\n") || "No significant waste patterns detected"}

Give 3-5 brief insights as bullet points. Focus on what the manager should DO differently this week.`;
}
