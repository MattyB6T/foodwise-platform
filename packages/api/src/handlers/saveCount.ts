import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface CountItemUpdate {
  itemId: string;
  actualQuantity: number;
}

interface SaveCountBody {
  items: CountItemUpdate[];
  status?: "in_progress" | "completed";
  notes?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const claims = getUserClaims(event);
    const storeId = event.pathParameters?.storeId;
    const countId = event.pathParameters?.countId;
    if (!storeId) return error("storeId is required", 400);
    if (!countId) return error("countId is required", 400);
    if (!event.body) return error("Request body is required", 400);

    const body: SaveCountBody = JSON.parse(event.body);

    // Get existing count
    const existing = await docClient.send(
      new GetCommand({
        TableName: TABLES.INVENTORY_COUNTS,
        Key: { countId },
      })
    );

    if (!existing.Item) return error("Count session not found", 404);
    if (existing.Item.storeId !== storeId) return error("Count not found for this store", 404);

    const countItems = existing.Item.items as any[];
    const updateMap = new Map(body.items.map((u) => [u.itemId, u.actualQuantity]));

    let completedItems = 0;
    let discrepancyCount = 0;
    const DISCREPANCY_THRESHOLD = 0.05; // 5%

    const updatedItems = countItems.map((item: any) => {
      const actual = updateMap.has(item.itemId) ? updateMap.get(item.itemId)! : item.actualQuantity;
      if (actual !== null && actual !== undefined) {
        completedItems++;
        const variance = actual - item.expectedQuantity;
        const variancePercent =
          item.expectedQuantity > 0
            ? Math.round((variance / item.expectedQuantity) * 10000) / 100
            : actual > 0 ? 100 : 0;

        if (Math.abs(variancePercent) > DISCREPANCY_THRESHOLD * 100) {
          discrepancyCount++;
        }

        return { ...item, actualQuantity: actual, variance, variancePercent };
      }
      return item;
    });

    const now = new Date().toISOString();
    const newStatus = body.status || existing.Item.status;

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.INVENTORY_COUNTS,
        Key: { countId },
        UpdateExpression:
          "SET #items = :items, #status = :status, updatedAt = :now, completedItems = :comp, discrepancyCount = :disc, completedBy = :by" +
          (body.notes !== undefined ? ", notes = :notes" : ""),
        ExpressionAttributeNames: {
          "#items": "items",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":items": updatedItems,
          ":status": newStatus,
          ":now": now,
          ":comp": completedItems,
          ":disc": discrepancyCount,
          ":by": claims.email,
          ...(body.notes !== undefined ? { ":notes": body.notes } : {}),
        },
      })
    );

    return success({
      countId,
      status: newStatus,
      totalItems: updatedItems.length,
      completedItems,
      discrepancyCount,
      updatedAt: now,
      items: updatedItems,
    });
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("SaveCount error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
