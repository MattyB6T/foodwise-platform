import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Recipe } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const category = event.queryStringParameters?.category;

    const params: {
      TableName: string;
      FilterExpression?: string;
      ExpressionAttributeValues?: Record<string, string>;
    } = {
      TableName: TABLES.RECIPES,
    };

    if (category) {
      params.FilterExpression = "category = :category";
      params.ExpressionAttributeValues = { ":category": category };
    }

    const result = await docClient.send(new ScanCommand(params));
    const recipes = (result.Items || []) as Recipe[];

    return success({ recipes });
  } catch (err) {
    console.error("ListRecipes error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
