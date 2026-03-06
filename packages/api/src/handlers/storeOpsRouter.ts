import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler as createStoreHandler } from "./createStore";
import { handler as listStoresHandler } from "./listStores";
import { handler as getInventoryHandler } from "./getInventory";
import { handler as updateInventoryHandler } from "./updateInventory";
import { handler as recordTransactionHandler } from "./recordTransaction";
import { handler as listTransactionsHandler } from "./listTransactions";
import { handler as getDashboardHandler } from "./getDashboard";

// Single Lambda that routes to the appropriate store-ops sub-handler
// This reduces CloudFormation resource count (1 Lambda instead of 7)
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const resource = event.resource || "";
  const path = event.path || "";
  const method = event.httpMethod || "";

  if (resource.includes("/dashboard") || path.includes("/dashboard")) {
    return getDashboardHandler(event);
  }
  if (resource.includes("/inventory") || path.includes("/inventory")) {
    if (method === "POST") {
      return updateInventoryHandler(event);
    }
    return getInventoryHandler(event);
  }
  if (resource.includes("/transactions") || path.includes("/transactions")) {
    if (method === "POST") {
      return recordTransactionHandler(event);
    }
    return listTransactionsHandler(event);
  }
  if (resource.includes("/stores") || path.includes("/stores")) {
    if (method === "POST") {
      return createStoreHandler(event);
    }
    return listStoresHandler(event);
  }

  return {
    statusCode: 404,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify({ message: "Store ops route not found" }),
  };
};
