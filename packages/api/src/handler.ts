import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ApiResponse } from "@foodwise/shared";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const response: ApiResponse<{ message: string }> = {
    statusCode: 200,
    body: { message: "Hello from FoodWise API!" },
  };

  return {
    statusCode: response.statusCode,
    body: JSON.stringify(response.body),
  };
};
