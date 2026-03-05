import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { InventoryItem } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface InventoryUpdateItem {
  itemId?: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  lowStockThreshold: number;
}

interface UpdateInventoryBody {
  items: InventoryUpdateItem[];
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event); // ensure authenticated

    const storeId = event.pathParameters?.storeId;
    if (!storeId) {
      return error("storeId is required", 400);
    }

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: UpdateInventoryBody = JSON.parse(event.body);

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return error("items array is required and must not be empty", 400);
    }

    const now = new Date().toISOString();
    const updatedItems: InventoryItem[] = [];

    for (const item of body.items) {
      if (!item.name || item.quantity == null || !item.unit) {
        return error("Each item requires name, quantity, and unit", 400);
      }

      const itemId = item.itemId || uuidv4();

      // If updating existing item, merge with current quantity
      let finalQuantity = item.quantity;
      if (item.itemId) {
        const existing = await docClient.send(
          new GetCommand({
            TableName: TABLES.INVENTORY,
            Key: { storeId, itemId: item.itemId },
          })
        );
        if (existing.Item) {
          finalQuantity = (existing.Item as InventoryItem).quantity + item.quantity;
        }
      }

      const inventoryItem: InventoryItem = {
        storeId,
        itemId,
        name: item.name,
        category: item.category || "uncategorized",
        quantity: finalQuantity,
        unit: item.unit,
        costPerUnit: item.costPerUnit || 0,
        lowStockThreshold: item.lowStockThreshold || 0,
        updatedAt: now,
      };

      await docClient.send(
        new PutCommand({
          TableName: TABLES.INVENTORY,
          Item: inventoryItem,
        })
      );

      updatedItems.push(inventoryItem);
    }

    return success({ storeId, updatedItems });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("UpdateInventory error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
