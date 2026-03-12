import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler as createSupplierHandler } from "./createSupplier";
import { handler as listSuppliersHandler } from "./listSuppliers";
import { handler as createPurchaseOrderHandler } from "./createPurchaseOrder";
import { handler as listPurchaseOrdersHandler } from "./listPurchaseOrders";
import { handler as updatePurchaseOrderHandler } from "./updatePurchaseOrder";
import { handler as emailPurchaseOrderHandler } from "./emailPurchaseOrder";
import { handler as receivePurchaseOrderHandler } from "./receivePurchaseOrder";
import { handler as receiveShipmentHandler } from "./receiveShipment";
import { handler as listReceivingLogsHandler } from "./listReceivingLogs";
import { handler as lookupBarcodeHandler } from "./lookupBarcode";
import { error } from "../utils/response";
import { initTables } from "../utils/dynamo";

// Single Lambda that routes to the appropriate supply-chain sub-handler
// This reduces CloudFormation resource count (1 Lambda instead of 7)
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  await initTables();
  const resource = event.resource || "";
  const path = event.path || "";
  const method = event.httpMethod || "";

  if (resource.includes("/suppliers") || path.includes("/suppliers")) {
    if (method === "POST") {
      return createSupplierHandler(event);
    }
    if (method === "GET") {
      return listSuppliersHandler(event);
    }
  }
  if (resource.includes("/purchase-orders") || path.includes("/purchase-orders")) {
    // POST /purchase-orders/{orderId}/receive
    if (method === "POST" && path.includes("/receive")) {
      return receivePurchaseOrderHandler(event);
    }
    // POST /purchase-orders/{orderId}/email
    if (method === "POST" && path.includes("/email")) {
      return emailPurchaseOrderHandler(event);
    }
    if (method === "POST") {
      return createPurchaseOrderHandler(event);
    }
    if (method === "GET") {
      return listPurchaseOrdersHandler(event);
    }
    if (method === "PUT") {
      return updatePurchaseOrderHandler(event);
    }
  }
  if (resource.includes("/receive") || path.includes("/receive")) {
    return receiveShipmentHandler(event);
  }
  if (resource.includes("/receiving-logs") || path.includes("/receiving-logs")) {
    return listReceivingLogsHandler(event);
  }
  if (resource.includes("/barcode") || path.includes("/barcode")) {
    return lookupBarcodeHandler(event);
  }

  return error("Supply chain route not found", 404, "NOT_FOUND");
};
