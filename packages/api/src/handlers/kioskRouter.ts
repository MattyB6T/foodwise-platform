import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler as registerHandler } from "./kioskRegister";
import { handler as lookupHandler } from "./kioskLookup";
import { handler as clockInHandler } from "./kioskClockIn";
import { handler as clockOutHandler } from "./kioskClockOut";
import { handler as breakHandler } from "./kioskBreak";
import { handler as activeHandler } from "./kioskActive";
import { error } from "../utils/response";

// Single Lambda that routes to the appropriate kiosk sub-handler
// This reduces CloudFormation resource count (1 Lambda instead of 6)
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const resource = event.resource || "";
  const path = event.path || "";

  if (resource.includes("/kiosk/register") || path.endsWith("/kiosk/register")) {
    return registerHandler(event);
  }
  if (resource.includes("/kiosk/lookup") || path.endsWith("/kiosk/lookup")) {
    return lookupHandler(event);
  }
  if (resource.includes("/kiosk/clockin") || path.endsWith("/kiosk/clockin")) {
    return clockInHandler(event);
  }
  if (resource.includes("/kiosk/clockout") || path.endsWith("/kiosk/clockout")) {
    return clockOutHandler(event);
  }
  if (resource.includes("/kiosk/break") || path.includes("/kiosk/break/")) {
    return breakHandler(event);
  }
  if (resource.includes("/kiosk/active") || path.endsWith("/kiosk/active")) {
    return activeHandler(event);
  }

  return error("Kiosk route not found", 404, "NOT_FOUND");
};
