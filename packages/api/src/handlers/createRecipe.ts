import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Recipe, RecipeIngredient } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface CreateRecipeBody {
  name: string;
  category: string;
  sellingPrice: number;
  ingredients: {
    itemId: string;
    quantity: number;
    unit: string;
  }[];
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: CreateRecipeBody = JSON.parse(event.body);

    if (!body.name || body.sellingPrice == null || !body.ingredients?.length) {
      return error(
        "name, sellingPrice, and ingredients are required",
        400
      );
    }

    for (const ing of body.ingredients) {
      if (!ing.itemId || ing.quantity == null || !ing.unit) {
        return error(
          "Each ingredient requires itemId, quantity, and unit",
          400
        );
      }
    }

    const now = new Date().toISOString();
    const recipe: Recipe = {
      recipeId: uuidv4(),
      name: body.name,
      category: body.category || "uncategorized",
      ingredients: body.ingredients as RecipeIngredient[],
      sellingPrice: body.sellingPrice,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.RECIPES,
        Item: recipe,
      })
    );

    return success(recipe, 201);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("CreateRecipe error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
