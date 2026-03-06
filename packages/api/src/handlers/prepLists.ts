import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const claims = getUserClaims(event);
    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);
    const method = event.httpMethod;

    if (method === "GET") {
      const date = event.queryStringParameters?.date || new Date().toISOString().split("T")[0];

      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLES.PREP_LISTS,
          IndexName: "storeId-date-index",
          KeyConditionExpression: "storeId = :sid AND #date = :date",
          ExpressionAttributeNames: { "#date": "date" },
          ExpressionAttributeValues: { ":sid": storeId, ":date": date },
        })
      );

      return success({ prepLists: result.Items || [], date });
    }

    if (method === "POST") {
      if (!event.body) return error("Request body is required", 400);
      const body = JSON.parse(event.body);

      if (body.action === "generate") {
        // Auto-generate prep list based on forecasts and current inventory
        const date = body.date || new Date().toISOString().split("T")[0];

        const recipeResult = await docClient.send(
          new ScanCommand({ TableName: TABLES.RECIPES })
        );

        const inventoryResult = await docClient.send(
          new QueryCommand({
            TableName: TABLES.INVENTORY,
            KeyConditionExpression: "storeId = :sid",
            ExpressionAttributeValues: { ":sid": storeId },
          })
        );

        const inventory = new Map<string, number>();
        for (const item of inventoryResult.Items || []) {
          inventory.set(item.itemId, item.quantity || 0);
        }

        const prepItems = (recipeResult.Items || []).map((recipe: any) => ({
          recipeId: recipe.recipeId,
          recipeName: recipe.name,
          estimatedServings: recipe.defaultBatchSize || 10,
          ingredients: (recipe.ingredients || []).map((ing: any) => ({
            itemId: ing.itemId,
            name: ing.itemId,
            quantityNeeded: ing.quantity * (recipe.defaultBatchSize || 10),
            quantityOnHand: inventory.get(ing.itemId) || 0,
            unit: ing.unit,
          })),
          completed: false,
          assignedTo: null,
        }));

        const prepListId = uuidv4();
        const now = new Date().toISOString();

        const prepList = {
          prepListId,
          storeId,
          date,
          items: prepItems,
          createdBy: claims.email,
          createdAt: now,
          updatedAt: now,
          status: "pending",
        };

        await docClient.send(
          new PutCommand({ TableName: TABLES.PREP_LISTS, Item: prepList })
        );

        return success(prepList, 201);
      }

      // Manual prep list item
      const prepListId = body.prepListId;
      if (!prepListId) return error("prepListId is required", 400);

      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.PREP_LISTS,
          Key: { prepListId },
          UpdateExpression: "SET #items = :items, updatedAt = :now, #status = :status",
          ExpressionAttributeNames: { "#items": "items", "#status": "status" },
          ExpressionAttributeValues: {
            ":items": body.items,
            ":now": new Date().toISOString(),
            ":status": body.status || "in_progress",
          },
        })
      );

      return success({ message: "Prep list updated", prepListId });
    }

    return error("Method not allowed", 405);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("PrepLists error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
