import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);
    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);

    const days = parseInt(event.queryStringParameters?.days || "30", 10);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get transactions for the period
    const txnResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.TRANSACTIONS,
        IndexName: "timestamp-index",
        KeyConditionExpression: "storeId = :sid AND #ts >= :start",
        ExpressionAttributeNames: { "#ts": "timestamp" },
        ExpressionAttributeValues: { ":sid": storeId, ":start": startDate },
      })
    );

    // Get all recipes
    const recipeResult = await docClient.send(
      new ScanCommand({ TableName: TABLES.RECIPES })
    );

    const recipes = new Map<string, any>();
    for (const r of recipeResult.Items || []) {
      recipes.set(r.recipeId, r);
    }

    // Aggregate sales by recipe
    const recipeSales = new Map<string, { quantity: number; revenue: number; foodCost: number }>();

    for (const txn of txnResult.Items || []) {
      for (const li of txn.lineItems || []) {
        const existing = recipeSales.get(li.recipeId) || { quantity: 0, revenue: 0, foodCost: 0 };
        existing.quantity += li.quantity;
        existing.revenue += li.price * li.quantity;
        recipeSales.set(li.recipeId, existing);
      }

      // Distribute food cost proportionally
      if (txn.ingredientDeductions) {
        const totalAmount = txn.totalAmount || 1;
        for (const li of txn.lineItems || []) {
          const proportion = (li.price * li.quantity) / totalAmount;
          const existing = recipeSales.get(li.recipeId)!;
          existing.foodCost += (txn.foodCost || 0) * proportion;
        }
      }
    }

    // Calculate menu engineering matrix
    const totalQuantity = Array.from(recipeSales.values()).reduce((sum, s) => sum + s.quantity, 0);
    const avgQuantity = recipeSales.size > 0 ? totalQuantity / recipeSales.size : 0;
    const avgMarginPercent = 70; // typical target

    const menuItems = Array.from(recipeSales.entries()).map(([recipeId, sales]) => {
      const recipe = recipes.get(recipeId);
      const marginPercent = sales.revenue > 0
        ? Math.round(((sales.revenue - sales.foodCost) / sales.revenue) * 10000) / 100
        : 0;
      const isPopular = sales.quantity >= avgQuantity;
      const isProfitable = marginPercent >= avgMarginPercent;

      let category: string;
      if (isPopular && isProfitable) category = "Star";
      else if (isPopular && !isProfitable) category = "Plow Horse";
      else if (!isPopular && isProfitable) category = "Puzzle";
      else category = "Dog";

      return {
        recipeId,
        name: recipe?.name || recipeId,
        category,
        quantity: sales.quantity,
        revenue: Math.round(sales.revenue * 100) / 100,
        foodCost: Math.round(sales.foodCost * 100) / 100,
        marginPercent,
        contributionMargin: Math.round((sales.revenue - sales.foodCost) * 100) / 100,
      };
    });

    const stars = menuItems.filter((i) => i.category === "Star");
    const plowHorses = menuItems.filter((i) => i.category === "Plow Horse");
    const puzzles = menuItems.filter((i) => i.category === "Puzzle");
    const dogs = menuItems.filter((i) => i.category === "Dog");

    return success({
      storeId,
      period: { days, startDate },
      summary: {
        totalItems: menuItems.length,
        stars: stars.length,
        plowHorses: plowHorses.length,
        puzzles: puzzles.length,
        dogs: dogs.length,
        avgPopularity: Math.round(avgQuantity),
      },
      items: menuItems.sort((a, b) => b.contributionMargin - a.contributionMargin),
    });
  } catch (err) {
    console.error("MenuEngineering error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
