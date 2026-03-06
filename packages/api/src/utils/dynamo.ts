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
  FORECASTS: process.env.FORECASTS_TABLE!,
  SUPPLIERS: process.env.SUPPLIERS_TABLE!,
  PURCHASE_ORDERS: process.env.PURCHASE_ORDERS_TABLE!,
  RECEIVING_LOGS: process.env.RECEIVING_LOGS_TABLE!,
  WASTE_LOGS: process.env.WASTE_LOGS_TABLE!,
  CAMERAS: process.env.CAMERAS_TABLE!,
  INCIDENTS: process.env.INCIDENTS_TABLE!,
  INVENTORY_COUNTS: process.env.INVENTORY_COUNTS_TABLE!,
  NOTIFICATIONS: process.env.NOTIFICATIONS_TABLE!,
  STAFF: process.env.STAFF_TABLE!,
  SCHEDULES: process.env.SCHEDULES_TABLE!,
  TIME_CLOCK: process.env.TIME_CLOCK_TABLE!,
};
