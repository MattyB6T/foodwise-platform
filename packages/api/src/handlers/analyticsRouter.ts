import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler as getOwnerDashboardHandler } from "./getOwnerDashboard";
import { handler as getStoreComparisonHandler } from "./getStoreComparison";
import { handler as getHealthScoreHandler } from "./getHealthScore";
import { handler as generateReportHandler } from "./generateReport";
import { handler as menuEngineeringHandler } from "./menuEngineering";
import { error } from "../utils/response";

// Single Lambda that routes to the appropriate analytics sub-handler
// This reduces CloudFormation resource count (1 Lambda instead of 5)
export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const resource = event.resource || "";
  const path = event.path || "";

  if (resource.includes("/comparison") || path.includes("/comparison")) {
    return getStoreComparisonHandler(event);
  }
  if (resource.includes("/health-score") || path.includes("/health-score")) {
    return getHealthScoreHandler(event);
  }
  if (resource.includes("/menu-engineering") || path.includes("/menu-engineering")) {
    return menuEngineeringHandler(event);
  }
  if (resource.includes("/reports") || path.includes("/reports")) {
    return generateReportHandler(event);
  }
  if (resource.includes("/dashboard") || path.includes("/dashboard")) {
    return getOwnerDashboardHandler(event);
  }

  return error("Analytics route not found", 404, "NOT_FOUND");
};
