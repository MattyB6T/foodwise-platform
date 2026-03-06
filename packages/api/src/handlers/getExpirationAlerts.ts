import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);
    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);

    const daysAhead = parseInt(event.queryStringParameters?.days || "7", 10);

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.INVENTORY,
        KeyConditionExpression: "storeId = :sid",
        ExpressionAttributeValues: { ":sid": storeId },
      })
    );

    const now = new Date();
    const alertDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const items = (result.Items || [])
      .filter((item: any) => item.expirationDate)
      .map((item: any) => {
        const expDate = new Date(item.expirationDate);
        const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        return {
          itemId: item.itemId,
          name: item.name || item.itemId,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          expirationDate: item.expirationDate,
          daysUntilExpiry,
          status: daysUntilExpiry < 0 ? "expired" : daysUntilExpiry <= 2 ? "critical" : daysUntilExpiry <= daysAhead ? "warning" : "ok",
          batchId: item.batchId,
        };
      })
      .filter((item: any) => item.daysUntilExpiry <= daysAhead)
      .sort((a: any, b: any) => a.daysUntilExpiry - b.daysUntilExpiry);

    const expired = items.filter((i: any) => i.status === "expired");
    const critical = items.filter((i: any) => i.status === "critical");
    const warning = items.filter((i: any) => i.status === "warning");

    return success({
      storeId,
      daysAhead,
      summary: {
        expired: expired.length,
        critical: critical.length,
        warning: warning.length,
        total: items.length,
      },
      items,
    });
  } catch (err) {
    console.error("GetExpirationAlerts error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
