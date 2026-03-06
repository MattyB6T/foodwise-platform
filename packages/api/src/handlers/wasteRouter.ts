import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler as recordWasteHandler } from "./recordWaste";
import { handler as listWasteHandler } from "./listWaste";
import { handler as getWasteAnalyticsHandler } from "./getWasteAnalytics";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const resource = event.resource || "";
  const path = event.path || "";

  // GET /stores/{storeId}/waste/analytics — must be checked before plain /waste
  if (
    method === "GET" &&
    (resource.endsWith("/waste/analytics") ||
      /\/stores\/[^/]+\/waste\/analytics/.test(path))
  ) {
    return getWasteAnalyticsHandler(event);
  }

  // POST /stores/{storeId}/waste
  if (
    method === "POST" &&
    (resource.endsWith("/waste") || /\/stores\/[^/]+\/waste$/.test(path))
  ) {
    return recordWasteHandler(event);
  }

  // GET /stores/{storeId}/waste (no analytics path)
  if (
    method === "GET" &&
    (resource.endsWith("/waste") || /\/stores\/[^/]+\/waste$/.test(path))
  ) {
    return listWasteHandler(event);
  }

  return {
    statusCode: 404,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify({ message: "Waste route not found" }),
  };
};
