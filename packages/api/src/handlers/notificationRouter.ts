import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler as registerPushTokenHandler } from "./registerPushToken";
import { handler as getNotificationPrefsHandler } from "./getNotificationPrefs";
import { handler as updateNotificationPrefsHandler } from "./updateNotificationPrefs";
import { handler as sendNotificationHandler } from "./sendNotification";
import { error } from "../utils/response";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const resource = event.resource || "";
  const path = event.path || "";

  // POST /notifications/register
  if (
    method === "POST" &&
    (resource.endsWith("/notifications/register") ||
      path.endsWith("/notifications/register"))
  ) {
    return registerPushTokenHandler(event);
  }

  // GET /notifications/preferences
  if (
    method === "GET" &&
    (resource.endsWith("/notifications/preferences") ||
      path.endsWith("/notifications/preferences"))
  ) {
    return getNotificationPrefsHandler(event);
  }

  // PUT /notifications/preferences
  if (
    method === "PUT" &&
    (resource.endsWith("/notifications/preferences") ||
      path.endsWith("/notifications/preferences"))
  ) {
    return updateNotificationPrefsHandler(event);
  }

  // POST /notifications/send
  if (
    method === "POST" &&
    (resource.endsWith("/notifications/send") ||
      path.endsWith("/notifications/send"))
  ) {
    return sendNotificationHandler(event);
  }

  return error("Notification route not found", 404, "NOT_FOUND");
};
