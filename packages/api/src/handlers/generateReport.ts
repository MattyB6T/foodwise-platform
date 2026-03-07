import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface GenerateReportBody {
  storeId: string;
  reportType: "inventory" | "waste" | "sales" | "purchase_orders" | "count_variance" | "food_cost" | "labor" | "profit_loss";
  startDate?: string;
  endDate?: string;
  format?: "json" | "csv";
}

function toCSV(headers: string[], rows: Record<string, any>[]): string {
  const headerLine = headers.join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => {
      const val = row[h] ?? "";
      const str = String(val);
      return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")
  );
  return [headerLine, ...dataLines].join("\n");
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);
    if (!event.body) return error("Request body is required", 400);

    const body: GenerateReportBody = JSON.parse(event.body);
    if (!body.storeId || !body.reportType) {
      return error("storeId and reportType are required", 400);
    }

    const format = body.format || "json";
    const now = new Date();
    const startDate = body.startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = body.endDate || now.toISOString();

    let reportData: any;
    let csvContent: string | null = null;

    switch (body.reportType) {
      case "inventory": {
        const result = await docClient.send(
          new QueryCommand({
            TableName: TABLES.INVENTORY,
            KeyConditionExpression: "storeId = :sid",
            ExpressionAttributeValues: { ":sid": body.storeId },
          })
        );
        const items = result.Items || [];
        reportData = {
          reportType: "inventory",
          generatedAt: now.toISOString(),
          storeId: body.storeId,
          totalItems: items.length,
          items: items.map((i: any) => ({
            itemId: i.itemId,
            name: i.name,
            category: i.category,
            quantity: i.quantity,
            unit: i.unit,
            costPerUnit: i.costPerUnit,
            totalValue: (i.quantity || 0) * (i.costPerUnit || 0),
          })),
          totalInventoryValue: items.reduce((sum: number, i: any) => sum + (i.quantity || 0) * (i.costPerUnit || 0), 0),
        };
        if (format === "csv") {
          csvContent = toCSV(
            ["itemId", "name", "category", "quantity", "unit", "costPerUnit", "totalValue"],
            reportData.items
          );
        }
        break;
      }

      case "waste": {
        const result = await docClient.send(
          new QueryCommand({
            TableName: TABLES.WASTE_LOGS,
            IndexName: "storeId-timestamp-index",
            KeyConditionExpression: "storeId = :sid AND #ts BETWEEN :start AND :end",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: { ":sid": body.storeId, ":start": startDate, ":end": endDate },
          })
        );
        const logs = result.Items || [];
        reportData = {
          reportType: "waste",
          generatedAt: now.toISOString(),
          storeId: body.storeId,
          period: { startDate, endDate },
          totalEntries: logs.length,
          logs: logs.map((l: any) => ({
            wasteId: l.wasteId,
            ingredientId: l.ingredientId,
            quantity: l.quantity,
            reason: l.reason,
            notes: l.notes,
            timestamp: l.timestamp,
          })),
        };
        if (format === "csv") {
          csvContent = toCSV(
            ["wasteId", "ingredientId", "quantity", "reason", "notes", "timestamp"],
            reportData.logs
          );
        }
        break;
      }

      case "sales": {
        const result = await docClient.send(
          new QueryCommand({
            TableName: TABLES.TRANSACTIONS,
            IndexName: "timestamp-index",
            KeyConditionExpression: "storeId = :sid AND #ts BETWEEN :start AND :end",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: { ":sid": body.storeId, ":start": startDate, ":end": endDate },
          })
        );
        const txns = result.Items || [];
        const totalRevenue = txns.reduce((sum: number, t: any) => sum + (t.totalAmount || 0), 0);
        const totalFoodCost = txns.reduce((sum: number, t: any) => sum + (t.foodCost || 0), 0);
        reportData = {
          reportType: "sales",
          generatedAt: now.toISOString(),
          storeId: body.storeId,
          period: { startDate, endDate },
          totalTransactions: txns.length,
          totalRevenue,
          totalFoodCost,
          avgFoodCostPercent: totalRevenue > 0 ? Math.round((totalFoodCost / totalRevenue) * 10000) / 100 : 0,
          transactions: txns.map((t: any) => ({
            transactionId: t.transactionId,
            timestamp: t.timestamp,
            totalAmount: t.totalAmount,
            foodCost: t.foodCost,
            foodCostPercentage: t.foodCostPercentage,
            lineItemCount: t.lineItems?.length || 0,
          })),
        };
        if (format === "csv") {
          csvContent = toCSV(
            ["transactionId", "timestamp", "totalAmount", "foodCost", "foodCostPercentage", "lineItemCount"],
            reportData.transactions
          );
        }
        break;
      }

      case "purchase_orders": {
        const result = await docClient.send(
          new QueryCommand({
            TableName: TABLES.PURCHASE_ORDERS,
            IndexName: "storeId-index",
            KeyConditionExpression: "storeId = :sid",
            ExpressionAttributeValues: { ":sid": body.storeId },
          })
        );
        const orders = result.Items || [];
        reportData = {
          reportType: "purchase_orders",
          generatedAt: now.toISOString(),
          storeId: body.storeId,
          totalOrders: orders.length,
          orders: orders.map((o: any) => ({
            orderId: o.orderId,
            supplierId: o.supplierId,
            status: o.status,
            totalAmount: o.totalAmount,
            createdAt: o.createdAt,
          })),
          totalSpend: orders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0),
        };
        if (format === "csv") {
          csvContent = toCSV(
            ["orderId", "supplierId", "status", "totalAmount", "createdAt"],
            reportData.orders
          );
        }
        break;
      }

      case "labor": {
        const [staffResult, timeResult] = await Promise.all([
          docClient.send(
            new QueryCommand({
              TableName: TABLES.STAFF,
              IndexName: "storeId-index",
              KeyConditionExpression: "storeId = :sid",
              ExpressionAttributeValues: { ":sid": body.storeId },
            })
          ),
          docClient.send(
            new QueryCommand({
              TableName: TABLES.TIME_CLOCK,
              IndexName: "storeId-clockInTime-index",
              KeyConditionExpression: "storeId = :sid AND clockInTime BETWEEN :start AND :end",
              ExpressionAttributeValues: { ":sid": body.storeId, ":start": startDate, ":end": endDate },
            })
          ),
        ]);
        const staffItems = staffResult.Items || [];
        const timeEntries = timeResult.Items || [];
        const rateMap: Record<string, { name: string; rate: number }> = {};
        for (const s of staffItems) {
          rateMap[s.staffId] = { name: s.name, rate: s.hourlyRate || 0 };
        }
        // Aggregate by employee
        const byEmployee: Record<string, { staffId: string; name: string; hourlyRate: number; totalHours: number; totalCost: number; entries: number; overtime: number }> = {};
        for (const e of timeEntries) {
          const hours = e.totalHours || 0;
          const info = rateMap[e.staffId] || { name: e.staffName || "Unknown", rate: 0 };
          if (!byEmployee[e.staffId]) {
            byEmployee[e.staffId] = { staffId: e.staffId, name: info.name, hourlyRate: info.rate, totalHours: 0, totalCost: 0, entries: 0, overtime: 0 };
          }
          byEmployee[e.staffId].totalHours += hours;
          byEmployee[e.staffId].totalCost += hours * info.rate;
          byEmployee[e.staffId].entries++;
        }
        // Calculate overtime (hours over 40/week, simplified as total > 40 per week)
        for (const emp of Object.values(byEmployee)) {
          const periodDays = Math.max(1, (new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000));
          const weeks = Math.max(1, periodDays / 7);
          const weeklyAvg = emp.totalHours / weeks;
          emp.overtime = Math.max(0, Math.round((weeklyAvg - 40) * weeks * 100) / 100);
          emp.totalHours = Math.round(emp.totalHours * 100) / 100;
          emp.totalCost = Math.round(emp.totalCost * 100) / 100;
        }
        const employees = Object.values(byEmployee).sort((a, b) => b.totalCost - a.totalCost);
        const totalLaborCost = employees.reduce((s, e) => s + e.totalCost, 0);
        const totalHours = employees.reduce((s, e) => s + e.totalHours, 0);
        const totalOvertime = employees.reduce((s, e) => s + e.overtime, 0);
        // Get revenue for labor cost %
        const txForLabor = await docClient.send(
          new QueryCommand({
            TableName: TABLES.TRANSACTIONS,
            IndexName: "timestamp-index",
            KeyConditionExpression: "storeId = :sid AND #ts BETWEEN :start AND :end",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: { ":sid": body.storeId, ":start": startDate, ":end": endDate },
          })
        );
        const laborRevenue = (txForLabor.Items || []).reduce((s: number, t: any) => s + (t.totalAmount || 0), 0);
        reportData = {
          reportType: "labor",
          generatedAt: now.toISOString(),
          storeId: body.storeId,
          period: { startDate, endDate },
          totalEmployees: employees.length,
          totalHours: Math.round(totalHours * 100) / 100,
          totalLaborCost: Math.round(totalLaborCost * 100) / 100,
          totalOvertime: Math.round(totalOvertime * 100) / 100,
          laborCostPercentage: laborRevenue > 0 ? Math.round((totalLaborCost / laborRevenue) * 10000) / 100 : 0,
          revenue: Math.round(laborRevenue * 100) / 100,
          employees,
        };
        if (format === "csv") {
          csvContent = toCSV(
            ["staffId", "name", "hourlyRate", "totalHours", "overtime", "totalCost", "entries"],
            employees
          );
        }
        break;
      }

      case "profit_loss": {
        // Fetch transactions, waste, and labor in parallel
        const [plTx, plWaste, plStaff, plTime] = await Promise.all([
          docClient.send(
            new QueryCommand({
              TableName: TABLES.TRANSACTIONS,
              IndexName: "timestamp-index",
              KeyConditionExpression: "storeId = :sid AND #ts BETWEEN :start AND :end",
              ExpressionAttributeNames: { "#ts": "timestamp" },
              ExpressionAttributeValues: { ":sid": body.storeId, ":start": startDate, ":end": endDate },
            })
          ),
          docClient.send(
            new QueryCommand({
              TableName: TABLES.WASTE_LOGS,
              IndexName: "storeId-timestamp-index",
              KeyConditionExpression: "storeId = :sid AND #ts BETWEEN :start AND :end",
              ExpressionAttributeNames: { "#ts": "timestamp" },
              ExpressionAttributeValues: { ":sid": body.storeId, ":start": startDate, ":end": endDate },
            })
          ),
          docClient.send(
            new QueryCommand({
              TableName: TABLES.STAFF,
              IndexName: "storeId-index",
              KeyConditionExpression: "storeId = :sid",
              ExpressionAttributeValues: { ":sid": body.storeId },
            })
          ),
          docClient.send(
            new QueryCommand({
              TableName: TABLES.TIME_CLOCK,
              IndexName: "storeId-clockInTime-index",
              KeyConditionExpression: "storeId = :sid AND clockInTime BETWEEN :start AND :end",
              ExpressionAttributeValues: { ":sid": body.storeId, ":start": startDate, ":end": endDate },
            })
          ),
        ]);
        const plTxns = plTx.Items || [];
        const plWasteLogs = plWaste.Items || [];
        const plStaffItems = plStaff.Items || [];
        const plTimeEntries = plTime.Items || [];

        const revenue = plTxns.reduce((s: number, t: any) => s + (t.totalAmount || 0), 0);
        const foodCost = plTxns.reduce((s: number, t: any) => s + (t.foodCost || 0), 0);
        const wasteCost = plWasteLogs.reduce((s: number, w: any) => s + (w.totalCost || 0), 0);

        const plRateMap: Record<string, number> = {};
        for (const s of plStaffItems) { if (s.hourlyRate) plRateMap[s.staffId] = s.hourlyRate; }
        let laborCost = 0;
        let laborHours = 0;
        for (const e of plTimeEntries) {
          const h = e.totalHours || 0;
          laborHours += h;
          laborCost += h * (plRateMap[e.staffId] || 0);
        }

        const totalExpenses = foodCost + laborCost + wasteCost;
        const grossProfit = revenue - foodCost;
        const netProfit = revenue - totalExpenses;

        reportData = {
          reportType: "profit_loss",
          generatedAt: now.toISOString(),
          storeId: body.storeId,
          period: { startDate, endDate },
          revenue: Math.round(revenue * 100) / 100,
          foodCost: Math.round(foodCost * 100) / 100,
          foodCostPercent: revenue > 0 ? Math.round((foodCost / revenue) * 10000) / 100 : 0,
          laborCost: Math.round(laborCost * 100) / 100,
          laborCostPercent: revenue > 0 ? Math.round((laborCost / revenue) * 10000) / 100 : 0,
          laborHours: Math.round(laborHours * 100) / 100,
          wasteCost: Math.round(wasteCost * 100) / 100,
          wasteCostPercent: revenue > 0 ? Math.round((wasteCost / revenue) * 10000) / 100 : 0,
          totalExpenses: Math.round(totalExpenses * 100) / 100,
          grossProfit: Math.round(grossProfit * 100) / 100,
          grossMargin: revenue > 0 ? Math.round((grossProfit / revenue) * 10000) / 100 : 0,
          netProfit: Math.round(netProfit * 100) / 100,
          netMargin: revenue > 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0,
          transactions: plTxns.length,
          wasteEntries: plWasteLogs.length,
        };
        if (format === "csv") {
          csvContent = toCSV(
            ["metric", "value", "percentage"],
            [
              { metric: "Revenue", value: reportData.revenue, percentage: "100%" },
              { metric: "Food Cost", value: reportData.foodCost, percentage: reportData.foodCostPercent + "%" },
              { metric: "Labor Cost", value: reportData.laborCost, percentage: reportData.laborCostPercent + "%" },
              { metric: "Waste Cost", value: reportData.wasteCost, percentage: reportData.wasteCostPercent + "%" },
              { metric: "Gross Profit", value: reportData.grossProfit, percentage: reportData.grossMargin + "%" },
              { metric: "Net Profit", value: reportData.netProfit, percentage: reportData.netMargin + "%" },
            ]
          );
        }
        break;
      }

      case "count_variance": {
        // Get all completed counts for this store
        const countResult = await docClient.send(
          new QueryCommand({
            TableName: TABLES.INVENTORY_COUNTS,
            IndexName: "storeId-timestamp-index",
            KeyConditionExpression: "storeId = :sid",
            ExpressionAttributeValues: { ":sid": body.storeId },
          })
        );
        const counts = (countResult.Items || [])
          .filter((c: any) => c.status === "completed" && c.completedAt >= startDate && c.completedAt <= endDate)
          .sort((a: any, b: any) => b.completedAt?.localeCompare(a.completedAt));

        const variances: any[] = [];
        let totalExpected = 0;
        let totalActual = 0;
        for (const count of counts) {
          for (const item of count.items || []) {
            if (item.actualQuantity !== null && item.actualQuantity !== undefined) {
              const variance = item.actualQuantity - item.expectedQuantity;
              const variancePct = item.expectedQuantity > 0
                ? Math.round((variance / item.expectedQuantity) * 10000) / 100
                : 0;
              totalExpected += item.expectedQuantity;
              totalActual += item.actualQuantity;
              if (Math.abs(variancePct) > 2) {
                variances.push({
                  countId: count.countId,
                  date: count.completedAt?.split("T")[0] || count.createdAt?.split("T")[0],
                  itemName: item.name,
                  expected: item.expectedQuantity,
                  actual: item.actualQuantity,
                  variance,
                  variancePercent: variancePct,
                  unit: item.unit,
                });
              }
            }
          }
        }
        variances.sort((a, b) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent));

        reportData = {
          reportType: "count_variance",
          generatedAt: now.toISOString(),
          storeId: body.storeId,
          period: { startDate, endDate },
          countsAnalyzed: counts.length,
          totalVarianceItems: variances.length,
          totalExpected,
          totalActual,
          overallVariancePercent: totalExpected > 0 ? Math.round(((totalActual - totalExpected) / totalExpected) * 10000) / 100 : 0,
          variances: variances.slice(0, 50),
        };
        if (format === "csv") {
          csvContent = toCSV(
            ["date", "countId", "itemName", "expected", "actual", "variance", "variancePercent", "unit"],
            variances
          );
        }
        break;
      }

      case "food_cost": {
        // Weekly food cost trend
        const fcResult = await docClient.send(
          new QueryCommand({
            TableName: TABLES.TRANSACTIONS,
            IndexName: "timestamp-index",
            KeyConditionExpression: "storeId = :sid AND #ts BETWEEN :start AND :end",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: { ":sid": body.storeId, ":start": startDate, ":end": endDate },
          })
        );
        const fcTxns = fcResult.Items || [];

        // Group by week
        const weekBuckets: Record<string, { revenue: number; foodCost: number; count: number }> = {};
        for (const tx of fcTxns) {
          const d = new Date(tx.timestamp);
          // Week start = Monday
          const day = d.getUTCDay();
          const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
          const weekStart = new Date(d);
          weekStart.setUTCDate(diff);
          const weekKey = weekStart.toISOString().split("T")[0];
          if (!weekBuckets[weekKey]) weekBuckets[weekKey] = { revenue: 0, foodCost: 0, count: 0 };
          weekBuckets[weekKey].revenue += tx.totalAmount || 0;
          weekBuckets[weekKey].foodCost += tx.foodCost || 0;
          weekBuckets[weekKey].count++;
        }

        const weeks = Object.entries(weekBuckets)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([weekStart, data]) => ({
            weekStart,
            revenue: Math.round(data.revenue * 100) / 100,
            foodCost: Math.round(data.foodCost * 100) / 100,
            foodCostPercent: data.revenue > 0 ? Math.round((data.foodCost / data.revenue) * 10000) / 100 : 0,
            transactions: data.count,
          }));

        const totalRev = fcTxns.reduce((s: number, t: any) => s + (t.totalAmount || 0), 0);
        const totalFC = fcTxns.reduce((s: number, t: any) => s + (t.foodCost || 0), 0);
        const trend = weeks.length >= 2
          ? weeks[weeks.length - 1].foodCostPercent - weeks[0].foodCostPercent
          : 0;

        reportData = {
          reportType: "food_cost",
          generatedAt: now.toISOString(),
          storeId: body.storeId,
          period: { startDate, endDate },
          overallFoodCostPercent: totalRev > 0 ? Math.round((totalFC / totalRev) * 10000) / 100 : 0,
          totalRevenue: Math.round(totalRev * 100) / 100,
          totalFoodCost: Math.round(totalFC * 100) / 100,
          trendDirection: trend > 1 ? "increasing" : trend < -1 ? "decreasing" : "stable",
          trendChange: Math.round(trend * 100) / 100,
          weeksAnalyzed: weeks.length,
          weeks,
        };
        if (format === "csv") {
          csvContent = toCSV(
            ["weekStart", "revenue", "foodCost", "foodCostPercent", "transactions"],
            weeks
          );
        }
        break;
      }

      default:
        return error(`Unsupported report type: ${body.reportType}`, 400);
    }

    if (format === "csv" && csvContent) {
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${body.reportType}-report-${now.toISOString().split("T")[0]}.csv"`,
          "Access-Control-Allow-Origin": "*",
        },
        body: csvContent,
      };
    }

    return success(reportData);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("GenerateReport error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
