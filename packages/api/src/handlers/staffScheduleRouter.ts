import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler as listStaffHandler } from "./listStaff";
import { handler as manageStaffHandler } from "./manageStaff";
import { handler as manageScheduleHandler } from "./manageSchedule";

// Single Lambda that routes to the appropriate staff/schedule sub-handler
// This reduces CloudFormation resource count (1 Lambda instead of 3)
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const resource = event.resource || "";
  const path = event.path || "";
  const method = event.httpMethod || "";

  // Check more specific routes first: /schedule before /staff
  if (resource.includes("/schedule") || path.includes("/schedule")) {
    return manageScheduleHandler(event);
  }
  if (
    resource.includes("/staff") &&
    method === "GET" &&
    resource.endsWith("/staff")
  ) {
    return listStaffHandler(event);
  }
  if (resource.includes("/staff") || path.includes("/staff")) {
    return manageStaffHandler(event);
  }

  return {
    statusCode: 404,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    },
    body: JSON.stringify({ message: "Staff/schedule route not found" }),
  };
};
