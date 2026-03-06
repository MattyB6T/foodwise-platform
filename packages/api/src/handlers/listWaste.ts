import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { WasteLog } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const storeId = event.pathParameters?.storeId;
    if (!storeId) {
      return error("storeId is required", 400);
    }

    const startDate = event.queryStringParameters?.startDate;
    const endDate = event.queryStringParameters?.endDate;
    const reason = event.queryStringParameters?.reason;

    // Build query with optional date range filter on the timestamp sort key
    let keyCondition = "storeId = :storeId";
    const exprValues: Record<string, string> = { ":storeId": storeId };

    if (startDate && endDate) {
      keyCondition += " AND #ts BETWEEN :start AND :end";
      exprValues[":start"] = startDate;
      exprValues[":end"] = endDate;
    } else if (startDate) {
      keyCondition += " AND #ts >= :start";
      exprValues[":start"] = startDate;
    } else if (endDate) {
      keyCondition += " AND #ts <= :end";
      exprValues[":end"] = endDate;
    }

    const needsTimestampAlias = startDate || endDate;

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.WASTE_LOGS,
        IndexName: "storeId-timestamp-index",
        KeyConditionExpression: keyCondition,
        ...(needsTimestampAlias && {
          ExpressionAttributeNames: { "#ts": "timestamp" },
        }),
        ...(reason && {
          FilterExpression: "reason = :reason",
          ExpressionAttributeNames: {
            ...(needsTimestampAlias && { "#ts": "timestamp" }),
          },
        }),
        ExpressionAttributeValues: {
          ...exprValues,
          ...(reason && { ":reason": reason }),
        },
        ScanIndexForward: false,
      })
    );

    const logs = (result.Items || []) as WasteLog[];

    const totalWasteCost = logs.reduce((sum, l) => sum + l.totalCost, 0);
    const totalQuantity = logs.reduce((sum, l) => sum + l.quantity, 0);

    return success({
      storeId,
      wasteLogs: logs,
      summary: {
        totalEntries: logs.length,
        totalQuantity: Math.round(totalQuantity * 100) / 100,
        totalCost: Math.round(totalWasteCost * 100) / 100,
      },
    });
  } catch (err) {
    console.error("ListWaste error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
