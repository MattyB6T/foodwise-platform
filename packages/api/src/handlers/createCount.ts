import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface CreateCountBody {
  notes?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const claims = getUserClaims(event);
    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);

    const body: CreateCountBody = event.body ? JSON.parse(event.body) : {};

    // Fetch current inventory to build the count sheet
    const inventoryResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.INVENTORY,
        KeyConditionExpression: "storeId = :sid",
        ExpressionAttributeValues: { ":sid": storeId },
      })
    );

    const items = inventoryResult.Items || [];
    const countItems = items.map((item: any) => ({
      itemId: item.itemId,
      itemName: item.name || item.itemId,
      category: item.category || "Uncategorized",
      unit: item.unit || "each",
      expectedQuantity: item.quantity || 0,
      actualQuantity: null,
      variance: null,
      variancePercent: null,
    }));

    const now = new Date().toISOString();
    const countId = uuidv4();

    const countSession = {
      countId,
      storeId,
      status: "in_progress",
      createdBy: claims.email,
      createdAt: now,
      updatedAt: now,
      timestamp: now,
      notes: body.notes || "",
      items: countItems,
      totalItems: countItems.length,
      completedItems: 0,
      discrepancyCount: 0,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.INVENTORY_COUNTS,
        Item: countSession,
      })
    );

    return success(countSession, 201);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("CreateCount error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
