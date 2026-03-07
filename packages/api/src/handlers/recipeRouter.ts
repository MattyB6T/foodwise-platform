import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler as createRecipeHandler } from "./createRecipe";
import { handler as listRecipesHandler } from "./listRecipes";
import { handler as getRecipeHandler } from "./getRecipe";
import { handler as upsertIngredientHandler } from "./upsertIngredient";
import { handler as recipeScalingHandler } from "./recipeScaling";
import { error } from "../utils/response";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const resource = event.resource || "";
  const path = event.path || "";

  // PUT /recipes/{recipeId}/ingredients
  if (
    method === "PUT" &&
    (resource.includes("/recipes/{recipeId}/ingredients") ||
      /\/recipes\/[^/]+\/ingredients/.test(path))
  ) {
    return upsertIngredientHandler(event);
  }

  // GET /recipes/{recipeId}/scale
  if (
    method === "GET" &&
    (resource.includes("/recipes/{recipeId}/scale") ||
      /\/recipes\/[^/]+\/scale/.test(path))
  ) {
    return recipeScalingHandler(event);
  }

  // GET /recipes/{recipeId}
  if (
    method === "GET" &&
    (resource === "/recipes/{recipeId}" ||
      /\/recipes\/[^/]+$/.test(path))
  ) {
    return getRecipeHandler(event);
  }

  // POST /recipes
  if (
    method === "POST" &&
    (resource === "/recipes" || /\/recipes$/.test(path))
  ) {
    return createRecipeHandler(event);
  }

  // GET /recipes
  if (
    method === "GET" &&
    (resource === "/recipes" || /\/recipes$/.test(path))
  ) {
    return listRecipesHandler(event);
  }

  return error("Recipe route not found", 404, "NOT_FOUND");
};
