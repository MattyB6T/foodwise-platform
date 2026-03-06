import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { Recipe, RecipeIngredient, InventoryItem } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const recipeId = event.pathParameters?.recipeId;
    if (!recipeId) {
      return error("recipeId is required", 400);
    }

    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.RECIPES,
        Key: { recipeId },
      })
    );

    if (!result.Item) {
      return error("Recipe not found", 404, "NOT_FOUND");
    }

    const recipe = result.Item as Recipe;

    // Look up current ingredient costs from inventory
    // Use a storeId query param to calculate cost for a specific store
    const storeId = event.queryStringParameters?.storeId;

    let calculatedCost: number | null = null;
    let ingredientDetails: {
      itemId: string;
      name: string;
      quantity: number;
      unit: string;
      costPerUnit: number;
      lineCost: number;
    }[] = [];

    if (storeId && recipe.ingredients.length > 0) {
      // Fetch inventory items for this store to get current prices
      const keys = recipe.ingredients.map((ing: RecipeIngredient) => ({
        storeId,
        itemId: ing.itemId,
      }));

      const batchResult = await docClient.send(
        new BatchGetCommand({
          RequestItems: {
            [TABLES.INVENTORY]: { Keys: keys },
          },
        })
      );

      const inventoryMap = new Map<string, InventoryItem>();
      for (const item of batchResult.Responses?.[TABLES.INVENTORY] || []) {
        const inv = item as InventoryItem;
        inventoryMap.set(inv.itemId, inv);
      }

      calculatedCost = 0;
      ingredientDetails = recipe.ingredients.map((ing: RecipeIngredient) => {
        const inv = inventoryMap.get(ing.itemId);
        const costPerUnit = inv?.costPerUnit || 0;
        const lineCost = costPerUnit * ing.quantity;
        calculatedCost! += lineCost;
        return {
          itemId: ing.itemId,
          name: inv?.name || ing.itemId,
          quantity: ing.quantity,
          unit: ing.unit,
          costPerUnit,
          lineCost,
        };
      });
    }

    return success({
      ...recipe,
      ...(storeId && {
        costBreakdown: {
          storeId,
          ingredientDetails,
          totalCost: calculatedCost,
          margin:
            calculatedCost != null
              ? Math.round(
                  ((recipe.sellingPrice - calculatedCost) /
                    recipe.sellingPrice) *
                    10000
                ) / 100
              : null,
        },
      }),
    });
  } catch (err) {
    console.error("GetRecipe error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
