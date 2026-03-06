import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface SetExpirationBody {
  itemId: string;
  expirationDate: string;
  shelfLifeDays?: number;
  batchId?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);
    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);
    if (!event.body) return error("Request body is required", 400);

    const body: SetExpirationBody = JSON.parse(event.body);
    if (!body.itemId || !body.expirationDate) {
      return error("itemId and expirationDate are required", 400);
    }

    const now = new Date().toISOString();

    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.INVENTORY,
        Key: { storeId, itemId: body.itemId },
        UpdateExpression:
          "SET expirationDate = :exp, shelfLifeDays = :shelf, batchId = :batch, updatedAt = :now",
        ExpressionAttributeValues: {
          ":exp": body.expirationDate,
          ":shelf": body.shelfLifeDays || null,
          ":batch": body.batchId || null,
          ":now": now,
        },
      })
    );

    return success({
      message: "Expiration date set",
      itemId: body.itemId,
      expirationDate: body.expirationDate,
    });
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("SetExpiration error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
