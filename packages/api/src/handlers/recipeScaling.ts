import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);
    const recipeId = event.pathParameters?.recipeId;
    if (!recipeId) return error("recipeId is required", 400);

    const targetServings = parseFloat(event.queryStringParameters?.servings || "1");
    const storeId = event.queryStringParameters?.storeId;

    // Get the recipe
    const recipeResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.RECIPES,
        Key: { recipeId },
      })
    );

    if (!recipeResult.Item) return error("Recipe not found", 404);
    const recipe = recipeResult.Item;

    const baseServings = recipe.servings || recipe.defaultBatchSize || 1;
    const scaleFactor = targetServings / baseServings;

    // Get current inventory if storeId provided
    let inventory = new Map<string, number>();
    if (storeId) {
      const invResult = await docClient.send(
        new QueryCommand({
          TableName: TABLES.INVENTORY,
          KeyConditionExpression: "storeId = :sid",
          ExpressionAttributeValues: { ":sid": storeId },
        })
      );
      for (const item of invResult.Items || []) {
        inventory.set(item.itemId, item.quantity || 0);
      }
    }

    const scaledIngredients = (recipe.ingredients || []).map((ing: any) => {
      const scaledQty = Math.round(ing.quantity * scaleFactor * 100) / 100;
      const onHand = inventory.get(ing.itemId) || 0;
      const shortage = storeId ? Math.max(0, scaledQty - onHand) : null;

      return {
        itemId: ing.itemId,
        name: ing.itemId,
        originalQuantity: ing.quantity,
        scaledQuantity: scaledQty,
        unit: ing.unit,
        onHand: storeId ? onHand : null,
        shortage,
        sufficient: storeId ? onHand >= scaledQty : null,
      };
    });

    const totalCost = scaledIngredients.reduce((sum: number, ing: any) => {
      return sum + (ing.scaledQuantity * (recipe.costPerUnit || 0));
    }, 0);

    return success({
      recipeId,
      recipeName: recipe.name,
      baseServings,
      targetServings,
      scaleFactor: Math.round(scaleFactor * 100) / 100,
      ingredients: scaledIngredients,
      estimatedCost: Math.round(totalCost * 100) / 100,
      hasShortages: scaledIngredients.some((i: any) => i.shortage > 0),
    });
  } catch (err) {
    console.error("RecipeScaling error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
