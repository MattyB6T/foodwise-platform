import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLES = {
  STORES: process.env.STORES_TABLE!,
  INVENTORY: process.env.INVENTORY_TABLE!,
  TRANSACTIONS: process.env.TRANSACTIONS_TABLE!,
  RECIPES: process.env.RECIPES_TABLE!,
};
