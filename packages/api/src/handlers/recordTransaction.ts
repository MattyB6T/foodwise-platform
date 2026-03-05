import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  PutCommand,
  GetCommand,
  UpdateCommand,
  BatchGetCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import {
  Transaction,
  TransactionLineItem,
  IngredientDeduction,
  Recipe,
  InventoryItem,
} from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface RecordTransactionBody {
  lineItems: {
    recipeId: string;
    quantity: number;
    price: number;
  }[];
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

    const body: RecordTransactionBody = JSON.parse(event.body);

    if (!body.lineItems || !Array.isArray(body.lineItems) || body.lineItems.length === 0) {
      return error("lineItems array is required and must not be empty", 400);
    }

    // Fetch all referenced recipes
    const recipeIds = [...new Set(body.lineItems.map((li) => li.recipeId))];
    const recipeResults = await docClient.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLES.RECIPES]: {
            Keys: recipeIds.map((recipeId) => ({ recipeId })),
          },
        },
      })
    );

    const recipes = new Map<string, Recipe>();
    for (const item of recipeResults.Responses?.[TABLES.RECIPES] || []) {
      const recipe = item as Recipe;
      recipes.set(recipe.recipeId, recipe);
    }

    // Validate all recipes exist
    for (const li of body.lineItems) {
      if (!recipes.has(li.recipeId)) {
        return error(`Recipe not found: ${li.recipeId}`, 404, "RECIPE_NOT_FOUND");
      }
    }

    // Calculate ingredient deductions
    const deductionMap = new Map<string, { quantity: number; itemName: string; unit: string }>();

    const transactionLineItems: TransactionLineItem[] = [];

    for (const li of body.lineItems) {
      const recipe = recipes.get(li.recipeId)!;

      transactionLineItems.push({
        recipeId: li.recipeId,
        recipeName: recipe.name,
        quantity: li.quantity,
        price: li.price,
      });

      for (const ingredient of recipe.ingredients) {
        const totalQty = ingredient.quantity * li.quantity;
        const existing = deductionMap.get(ingredient.itemId);
        if (existing) {
          existing.quantity += totalQty;
        } else {
          deductionMap.set(ingredient.itemId, {
            quantity: totalQty,
            itemName: ingredient.itemId, // will be resolved below
            unit: ingredient.unit,
          });
        }
      }
    }

    // Deduct from inventory
    const ingredientDeductions: IngredientDeduction[] = [];

    for (const [itemId, deduction] of deductionMap) {
      // Get current inventory item to resolve the name
      const inventoryResult = await docClient.send(
        new GetCommand({
          TableName: TABLES.INVENTORY,
          Key: { storeId, itemId },
        })
      );

      const inventoryItem = inventoryResult.Item as InventoryItem | undefined;
      const itemName = inventoryItem?.name || itemId;
      const costPerUnit = inventoryItem?.costPerUnit || 0;

      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.INVENTORY,
          Key: { storeId, itemId },
          UpdateExpression: "SET quantity = quantity - :qty, updatedAt = :now",
          ExpressionAttributeValues: {
            ":qty": deduction.quantity,
            ":now": new Date().toISOString(),
          },
        })
      );

      ingredientDeductions.push({
        itemId,
        itemName,
        quantityDeducted: deduction.quantity,
        unit: deduction.unit,
        costPerUnit,
        totalCost: costPerUnit * deduction.quantity,
      });
    }

    // Calculate food cost
    const foodCost = ingredientDeductions.reduce(
      (sum, d) => sum + d.totalCost,
      0
    );
    const totalAmount = transactionLineItems.reduce(
      (sum, li) => sum + li.price * li.quantity,
      0
    );
    const foodCostPercentage =
      totalAmount > 0
        ? Math.round((foodCost / totalAmount) * 10000) / 100
        : 0;

    // Record the transaction
    const now = new Date().toISOString();
    const transaction: Transaction = {
      storeId,
      transactionId: uuidv4(),
      timestamp: now,
      lineItems: transactionLineItems,
      totalAmount,
      foodCost,
      foodCostPercentage,
      ingredientDeductions,
      createdAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.TRANSACTIONS,
        Item: transaction,
      })
    );

    return success(transaction, 201);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("RecordTransaction error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
