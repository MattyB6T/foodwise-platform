import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);
    const storeId = event.pathParameters?.storeId;
    const countId = event.pathParameters?.countId;
    if (!storeId) return error("storeId is required", 400);
    if (!countId) return error("countId is required", 400);

    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.INVENTORY_COUNTS,
        Key: { countId },
      })
    );

    if (!result.Item) return error("Count not found", 404);
    if (result.Item.storeId !== storeId) return error("Count not found for this store", 404);

    const items = result.Item.items as any[];
    const THRESHOLD = 5; // 5%

    const discrepancies = items
      .filter((i: any) => i.actualQuantity !== null && Math.abs(i.variancePercent || 0) > THRESHOLD)
      .sort((a: any, b: any) => Math.abs(b.variancePercent) - Math.abs(a.variancePercent));

    const totalExpectedValue = items.reduce((sum: number, i: any) => sum + (i.expectedQuantity || 0), 0);
    const totalActualValue = items
      .filter((i: any) => i.actualQuantity !== null)
      .reduce((sum: number, i: any) => sum + i.actualQuantity, 0);

    return success({
      countId,
      storeId,
      status: result.Item.status,
      createdBy: result.Item.createdBy,
      completedBy: result.Item.completedBy,
      createdAt: result.Item.createdAt,
      updatedAt: result.Item.updatedAt,
      summary: {
        totalItems: items.length,
        completedItems: items.filter((i: any) => i.actualQuantity !== null).length,
        discrepancyCount: discrepancies.length,
        totalExpectedQuantity: totalExpectedValue,
        totalActualQuantity: totalActualValue,
        overallVariance: totalActualValue - totalExpectedValue,
      },
      discrepancies,
      items,
    });
  } catch (err) {
    console.error("GetCountVariance error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
