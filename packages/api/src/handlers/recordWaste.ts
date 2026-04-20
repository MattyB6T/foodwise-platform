import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { WasteLog, InventoryItem } from "@leantable/shared";
import { z } from "zod";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";
import { parseBody, safeString, positiveNumber } from "../utils/validate";

const recordWasteSchema = z.object({
  ingredientId: z.string().min(1, "ingredientId is required"),
  quantity: positiveNumber,
  reason: z.enum(["expired", "damaged", "over-prep", "dropped", "other"]),
  notes: safeString.optional(),
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserClaims(event);

    const storeId = event.pathParameters?.storeId;
    if (!storeId) {
      return error("storeId is required", 400);
    }

    const parsed = parseBody(event, recordWasteSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    // Fetch ingredient to get name and cost
    const ingredientResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.INVENTORY,
        Key: { storeId, itemId: body.ingredientId },
      })
    );

    if (!ingredientResult.Item) {
      return error("Ingredient not found in store inventory", 404, "INGREDIENT_NOT_FOUND");
    }

    const ingredient = ingredientResult.Item as InventoryItem;
    const totalCost =
      Math.round(body.quantity * ingredient.costPerUnit * 100) / 100;

    const now = new Date().toISOString();
    const wasteLog: WasteLog = {
      wasteId: uuidv4(),
      storeId,
      ingredientId: body.ingredientId,
      ingredientName: ingredient.name,
      quantity: body.quantity,
      unit: ingredient.unit,
      costPerUnit: ingredient.costPerUnit,
      totalCost,
      reason: body.reason,
      notes: body.notes,
      loggedBy: user.email,
      timestamp: now,
      createdAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.WASTE_LOGS,
        Item: wasteLog,
      })
    );

    return success(wasteLog, 201);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("RecordWaste error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
