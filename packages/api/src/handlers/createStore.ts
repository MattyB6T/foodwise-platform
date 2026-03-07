import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Store, OperatorType } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface CreateStoreBody {
  name: string;
  address: string;
  operatorType?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserClaims(event);

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: CreateStoreBody = JSON.parse(event.body);

    if (!body.name || !body.address) {
      return error("name and address are required", 400);
    }

    const validTypes: OperatorType[] = ["qsr", "cafe", "bar", "hybrid", "restaurant"];
    const operatorType: OperatorType =
      body.operatorType && validTypes.includes(body.operatorType as OperatorType)
        ? (body.operatorType as OperatorType)
        : "qsr";

    const now = new Date().toISOString();
    const store: Store = {
      storeId: uuidv4(),
      ownerId: user.sub,
      name: body.name,
      address: body.address,
      operatorType,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.STORES,
        Item: store,
      })
    );

    return success(store, 201);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("CreateStore error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
