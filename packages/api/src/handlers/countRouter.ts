import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler as createCountHandler } from "./createCount";
import { handler as listCountsHandler } from "./listCounts";
import { handler as saveCountHandler } from "./saveCount";
import { handler as getCountVarianceHandler } from "./getCountVariance";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const resource = event.resource || "";
  const path = event.path || "";

  // GET /stores/{storeId}/counts/{countId}/variance
  if (
    method === "GET" &&
    (resource.includes("/counts/{countId}/variance") ||
      /\/stores\/[^/]+\/counts\/[^/]+\/variance/.test(path))
  ) {
    return getCountVarianceHandler(event);
  }

  // PUT /stores/{storeId}/counts/{countId}
  if (
    method === "PUT" &&
    (resource.includes("/counts/{countId}") ||
      /\/stores\/[^/]+\/counts\/[^/]+$/.test(path))
  ) {
    return saveCountHandler(event);
  }

  // POST /stores/{storeId}/counts
  if (
    method === "POST" &&
    (resource.endsWith("/counts") || /\/stores\/[^/]+\/counts$/.test(path))
  ) {
    return createCountHandler(event);
  }

  // GET /stores/{storeId}/counts
  if (
    method === "GET" &&
    (resource.endsWith("/counts") || /\/stores\/[^/]+\/counts$/.test(path))
  ) {
    return listCountsHandler(event);
  }

  return {
    statusCode: 404,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    },
    body: JSON.stringify({ message: "Count route not found" }),
  };
};
