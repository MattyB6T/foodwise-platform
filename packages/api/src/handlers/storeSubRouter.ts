import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler as storeOpsHandler } from "./storeOpsRouter";
import { handler as wasteHandler } from "./wasteRouter";
import { handler as cameraIncidentHandler } from "./cameraIncidentRouter";
import { handler as countHandler } from "./countRouter";
import { handler as staffScheduleHandler } from "./staffScheduleRouter";
import { handler as analyticsHandler } from "./analyticsRouter";
import { handler as prepListsHandler } from "./prepLists";
import { handler as auditTrailHandler } from "./auditTrail";
import { handler as temperatureLogsHandler } from "./temperatureLogs";
import { handler as supplyChainHandler } from "./supplyChainRouter";
import { handler as timesheetHandler } from "./timesheetManagement";
import { handler as staffPinHandler } from "./staffPin";
import { handler as setExpirationHandler } from "./setExpiration";
import { handler as getExpirationAlertsHandler } from "./getExpirationAlerts";
import { handler as posIntegrationHandler } from "./posIntegrationRouter";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const path = event.path || "";

  // POS integration routes
  if (path.includes("/pos/")) return posIntegrationHandler(event);

  // Timeclock routes
  if (path.includes("/timeclock")) return timesheetHandler(event);

  // Count routes (must check variance before counts)
  if (path.includes("/counts")) return countHandler(event);

  // Camera & incident routes
  if (path.includes("/cameras") || path.includes("/incidents"))
    return cameraIncidentHandler(event);

  // Waste routes
  if (path.includes("/waste")) return wasteHandler(event);

  // Schedule routes
  if (path.includes("/schedule")) return staffScheduleHandler(event);

  // Staff PIN route (must come before general staff route)
  if (path.includes("/pin")) return staffPinHandler(event);

  // Staff routes
  if (path.includes("/staff")) return staffScheduleHandler(event);

  // Analytics routes
  if (path.includes("/menu-engineering") || path.includes("/health-score"))
    return analyticsHandler(event);

  // Prep lists
  if (path.includes("/prep-lists")) return prepListsHandler(event);

  // Audit trail
  if (path.includes("/audit-trail")) return auditTrailHandler(event);

  // Temperature logs
  if (path.includes("/temp-logs")) return temperatureLogsHandler(event);

  // Supply chain routes under stores
  if (
    path.includes("/purchase-orders") ||
    path.includes("/receive") ||
    path.includes("/receiving-logs")
  )
    return supplyChainHandler(event);

  // Expiration alerts (must come before general expiration)
  if (path.includes("/expiration/alerts"))
    return getExpirationAlertsHandler(event);

  // Expiration
  if (path.includes("/expiration")) return setExpirationHandler(event);

  // Inventory, transactions, dashboard — handled by storeOpsRouter
  if (
    path.includes("/inventory") ||
    path.includes("/transactions") ||
    path.includes("/dashboard")
  )
    return storeOpsHandler(event);

  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: "Store sub-route not found", path }),
  };
};
