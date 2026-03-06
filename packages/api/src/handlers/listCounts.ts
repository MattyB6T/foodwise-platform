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

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.INVENTORY_COUNTS,
        IndexName: "storeId-timestamp-index",
        KeyConditionExpression: "storeId = :sid",
        ExpressionAttributeValues: { ":sid": storeId },
        ScanIndexForward: false,
      })
    );

    // Return summary without full items array for list view
    const counts = (result.Items || []).map((c: any) => ({
      countId: c.countId,
      storeId: c.storeId,
      status: c.status,
      createdBy: c.createdBy,
      completedBy: c.completedBy,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      totalItems: c.totalItems,
      completedItems: c.completedItems,
      discrepancyCount: c.discrepancyCount,
      notes: c.notes,
    }));

    return success({ counts });
  } catch (err) {
    console.error("ListCounts error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
