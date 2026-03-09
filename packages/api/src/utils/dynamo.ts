import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm";

const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

/** Every DynamoDB table key — kept in sync with the SSM parameter in CoreStack. */
export interface TableNames {
  STORES: string;
  INVENTORY: string;
  TRANSACTIONS: string;
  RECIPES: string;
  FORECASTS: string;
  SUPPLIERS: string;
  PURCHASE_ORDERS: string;
  RECEIVING_LOGS: string;
  WASTE_LOGS: string;
  CAMERAS: string;
  INCIDENTS: string;
  INVENTORY_COUNTS: string;
  NOTIFICATIONS: string;
  STAFF: string;
  SCHEDULES: string;
  TIME_CLOCK: string;
  KIOSK_DEVICES: string;
  TEMP_LOGS: string;
  PRICE_HISTORY: string;
  PREP_LISTS: string;
  AUDIT_TRAIL: string;
  POS_CONNECTIONS: string;
  POS_TRANSACTIONS_RAW: string;
  INGREDIENT_MAPPINGS: string;
  FORECAST_ACCURACY: string;
  SECURITY_EVENTS: string;
  REVENUE_SOURCES: string;
  REVENUE_ENTRIES: string;
}

const ssmClient = new SSMClient({});
let _initialized = false;

/**
 * All DynamoDB table names. Populated by initTables() from SSM Parameter Store.
 * Must call `await initTables()` once at the start of each Lambda handler
 * before accessing any property.
 */
export const TABLES: TableNames = {} as TableNames;

/**
 * Fetch table names from SSM and populate the TABLES object.
 * Idempotent — safe to call multiple times, only fetches once per cold start.
 */
export async function initTables(): Promise<void> {
  if (_initialized) return;

  const paramPath = process.env.SSM_TABLE_NAMES_PATH;
  if (!paramPath) {
    throw new Error("SSM_TABLE_NAMES_PATH environment variable is not set");
  }

  const result = await ssmClient.send(
    new GetParameterCommand({ Name: paramPath })
  );

  if (!result.Parameter?.Value) {
    throw new Error(`SSM parameter ${paramPath} is empty or not found`);
  }

  const parsed: TableNames = JSON.parse(result.Parameter.Value);
  Object.assign(TABLES, parsed);
  _initialized = true;
}
