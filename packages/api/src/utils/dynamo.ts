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
  TEMP_LOGS: process.env.TEMP_LOGS_TABLE!,
  PRICE_HISTORY: process.env.PRICE_HISTORY_TABLE!,
  PREP_LISTS: process.env.PREP_LISTS_TABLE!,
  AUDIT_TRAIL: process.env.AUDIT_TRAIL_TABLE!,
  KIOSK_DEVICES: process.env.KIOSK_DEVICES_TABLE!,
  POS_CONNECTIONS: process.env.POS_CONNECTIONS_TABLE!,
  POS_TRANSACTIONS_RAW: process.env.POS_TRANSACTIONS_RAW_TABLE!,
  INGREDIENT_MAPPINGS: process.env.INGREDIENT_MAPPINGS_TABLE!,
  FORECAST_ACCURACY: process.env.FORECAST_ACCURACY_TABLE!,
};
