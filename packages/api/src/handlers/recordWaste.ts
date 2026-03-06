import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { WasteLog, WasteReason, InventoryItem } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface RecordWasteBody {
  ingredientId: string;
  quantity: number;
  reason: WasteReason;
  notes?: string;
}

const VALID_REASONS: WasteReason[] = [
  "expired",
  "damaged",
  "over-prep",
  "dropped",
  "other",
];

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserClaims(event);

    const storeId = event.pathParameters?.storeId;
    if (!storeId) {
      return error("storeId is required", 400);
    }

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: RecordWasteBody = JSON.parse(event.body);

    if (!body.ingredientId || !body.quantity || !body.reason) {
      return error("ingredientId, quantity, and reason are required", 400);
    }

    if (body.quantity <= 0) {
      return error("quantity must be greater than 0", 400);
    }

    if (!VALID_REASONS.includes(body.reason)) {
      return error(
        `reason must be one of: ${VALID_REASONS.join(", ")}`,
        400
      );
    }

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
