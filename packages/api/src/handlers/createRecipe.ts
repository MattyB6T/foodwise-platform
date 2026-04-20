import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Recipe, RecipeIngredient } from "@leantable/shared";
import { z } from "zod";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";
import { parseBody, safeString, price, quantity } from "../utils/validate";

const ingredientSchema = z.object({
  itemId: z.string().min(1, "itemId is required"),
  quantity: quantity,
  unit: z.string().min(1, "unit is required").max(50),
});

const createRecipeSchema = z.object({
  name: safeString.pipe(z.string().min(1, "name is required")),
  category: safeString.optional().default("uncategorized"),
  sellingPrice: price,
  ingredients: z.array(ingredientSchema).min(1, "At least one ingredient is required"),
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const parsed = parseBody(event, createRecipeSchema);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

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
