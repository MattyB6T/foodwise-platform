import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface GenerateReportBody {
  storeId: string;
  reportType: "inventory" | "waste" | "sales" | "purchase_orders" | "count_variance" | "food_cost";
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
