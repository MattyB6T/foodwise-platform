import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { Supplier } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const result = await docClient.send(
      new ScanCommand({ TableName: TABLES.SUPPLIERS })
    );

    const suppliers = (result.Items || []) as Supplier[];

    return success({ suppliers });
  } catch (err) {
    console.error("ListSuppliers error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
