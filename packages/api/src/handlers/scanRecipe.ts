import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { InventoryItem } from "@leantable/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

const bedrock = new BedrockRuntimeClient({});
const MODEL_ID =
  process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-20250514-v1:0";

function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () =>
    Array(lb + 1).fill(0)
  );
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[la][lb];
}

function fuzzyMatch(
  name: string,
  inventory: InventoryItem[]
): { itemId: string; itemName: string; confidence: number } | null {
  const normalized = name.toLowerCase().trim();
  let bestMatch: { itemId: string; itemName: string; confidence: number } | null = null;

  for (const item of inventory) {
    const invName = (item.name || item.itemId).toLowerCase().trim();

    if (invName === normalized) {
      return { itemId: item.itemId, itemName: item.name || item.itemId, confidence: 1 };
    }

    if (invName.includes(normalized) || normalized.includes(invName)) {
      const confidence = Math.min(invName.length, normalized.length) /
        Math.max(invName.length, normalized.length);
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { itemId: item.itemId, itemName: item.name || item.itemId, confidence: Math.max(0.7, confidence) };
      }
      continue;
    }

    const dist = levenshtein(invName, normalized);
    const maxLen = Math.max(invName.length, normalized.length);
    const confidence = maxLen > 0 ? 1 - dist / maxLen : 0;

    if (confidence > 0.5 && (!bestMatch || confidence > bestMatch.confidence)) {
      bestMatch = { itemId: item.itemId, itemName: item.name || item.itemId, confidence };
    }
  }

  return bestMatch;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);

    if (!event.body) return error("Request body is required", 400);

    const body = JSON.parse(event.body);
    const { imageBase64 } = body as { imageBase64: string };

    if (!imageBase64) return error("imageBase64 is required", 400);

    const base64Data = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    // Detect media type from data URI prefix, default to jpeg
    let mediaType = "image/jpeg";
    if (imageBase64.startsWith("data:")) {
      const match = imageBase64.match(/^data:(image\/\w+);/);
      if (match) mediaType = match[1];
    }

    const response = await bedrock.send(
      new InvokeModelCommand({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify({
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 2048,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mediaType,
                    data: base64Data,
                  },
                },
                {
                  type: "text",
                  text: `You are a recipe parser for a restaurant management system. Extract the recipe from this image — it could be a handwritten recipe card, a printed recipe, a screenshot, a cookbook page, or a menu item description.

Return ONLY valid JSON with this exact structure (no markdown, no explanation):
{
  "name": "recipe name",
  "category": "Appetizers/Entrees/Salads/Soups/Desserts/Beverages/Sides/Sauces/other",
  "servings": number or 1 if not specified,
  "ingredients": [
    {
      "name": "ingredient name (just the base ingredient, e.g. 'chicken breast' not '2 lbs boneless skinless chicken breast')",
      "quantity": number,
      "unit": "oz/lb/cup/tbsp/tsp/each/gal/quart/pint/ml/g/kg"
    }
  ],
  "instructions": "brief preparation steps if visible, or empty string",
  "estimatedPrepMinutes": number or 0 if unknown
}

Rules:
- Extract every ingredient you can read, even if partially illegible
- Normalize units: "tablespoon" → "tbsp", "teaspoon" → "tsp", "pound" → "lb", "ounce" → "oz"
- Convert fractions to decimals: "1/2" → 0.5, "1/4" → 0.25, "3/4" → 0.75
- If quantity is missing, estimate a reasonable amount or use 1
- Category should be one of the standard types listed, or use the closest match
- For "name", use the recipe title if visible, otherwise describe the dish`,
                },
              ],
            },
          ],
        }),
      })
    );

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const rawText = responseBody.content?.[0]?.text || "{}";

    let parsed: {
      name: string;
      category: string;
      servings: number;
      ingredients: { name: string; quantity: number; unit: string }[];
      instructions: string;
      estimatedPrepMinutes: number;
    };

    try {
      const jsonStr = rawText.includes("```")
        ? rawText.replace(/```json?\n?/g, "").replace(/```/g, "").trim()
        : rawText.trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse Claude recipe response:", rawText);
      return error("Could not read the recipe. Please try a clearer photo.", 422);
    }

    if (!parsed.ingredients || parsed.ingredients.length === 0) {
      return error("No ingredients found in the image. Please try a clearer photo.", 422);
    }

    // Fetch store inventory for fuzzy matching
    const inventoryRes = await docClient.send(
      new QueryCommand({
        TableName: TABLES.INVENTORY,
        KeyConditionExpression: "storeId = :s",
        ExpressionAttributeValues: { ":s": storeId },
      })
    );
    const inventory = (inventoryRes.Items || []) as InventoryItem[];

    // Match each ingredient to inventory
    const matchedIngredients = parsed.ingredients.map((ing) => {
      const match = fuzzyMatch(ing.name, inventory);
      return {
        name: ing.name,
        quantity: ing.quantity || 1,
        unit: ing.unit || "each",
        matchedItemId: match?.itemId || null,
        matchedItemName: match?.itemName || null,
        matchConfidence: match?.confidence || 0,
      };
    });

    return success({
      name: parsed.name || "Untitled Recipe",
      category: parsed.category || "uncategorized",
      servings: parsed.servings || 1,
      ingredients: matchedIngredients,
      instructions: parsed.instructions || "",
      estimatedPrepMinutes: parsed.estimatedPrepMinutes || 0,
    });
  } catch (err: any) {
    if (err.name === "ThrottlingException") {
      return error("AI service is busy. Please try again in a moment.", 429);
    }
    if (err.name === "AccessDeniedException") {
      return error("AI service not available", 503);
    }
    if (err instanceof SyntaxError) {
      return error("Invalid request body", 400);
    }
    console.error("ScanRecipe error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
