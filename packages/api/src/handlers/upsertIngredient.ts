import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { InventoryItem } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface UpsertIngredientBody {
  storeId: string;
  itemId?: string;
  name: string;
  unit: string;
  costPerUnit: number;
  supplier: string;
  reorderThreshold: number;
  category?: string;
  quantity?: number;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: UpsertIngredientBody = JSON.parse(event.body);

    if (!body.storeId || !body.name || !body.unit || body.costPerUnit == null) {
      return error(
        "storeId, name, unit, and costPerUnit are required",
        400
      );
    }

    const now = new Date().toISOString();
    const itemId = body.itemId || uuidv4();

    // If updating, preserve existing quantity
    let currentQuantity = body.quantity ?? 0;
    if (body.itemId) {
      const existing = await docClient.send(
        new GetCommand({
          TableName: TABLES.INVENTORY,
          Key: { storeId: body.storeId, itemId: body.itemId },
        })
      );
      if (existing.Item) {
        currentQuantity = (existing.Item as InventoryItem).quantity;
      }
    }

    const ingredient: InventoryItem = {
      storeId: body.storeId,
      itemId,
      name: body.name,
      category: body.category || "uncategorized",
      quantity: currentQuantity,
      unit: body.unit,
      costPerUnit: body.costPerUnit,
      lowStockThreshold: body.reorderThreshold || 0,
      supplier: body.supplier,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.INVENTORY,
        Item: ingredient,
      })
    );

    return success(ingredient, body.itemId ? 200 : 201);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("UpsertIngredient error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
