import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Incident, IncidentType } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface CreateIncidentBody {
  type: IncidentType;
  title: string;
  notes: string;
  timestamp: string;
  cameraId?: string;
  transactionId?: string;
  wasteId?: string;
}

const VALID_TYPES: IncidentType[] = [
  "theft",
  "waste-verification",
  "safety",
  "discrepancy",
  "other",
];

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserClaims(event);

    const storeId = event.pathParameters?.storeId;
    if (!storeId) {
      return error("storeId is required", 400);
    }

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: CreateIncidentBody = JSON.parse(event.body);

    if (!body.type || !body.title || !body.timestamp) {
      return error("type, title, and timestamp are required", 400);
    }

    if (!VALID_TYPES.includes(body.type)) {
      return error(`type must be one of: ${VALID_TYPES.join(", ")}`, 400);
    }

    // Calculate footage time range: 2 minutes before and after the timestamp
    const eventTime = new Date(body.timestamp);
    const footageStart = new Date(eventTime.getTime() - 2 * 60 * 1000);
    const footageEnd = new Date(eventTime.getTime() + 2 * 60 * 1000);

    // If a cameraId is provided, validate it exists
    if (body.cameraId) {
      const cameraResult = await docClient.send(
        new GetCommand({
          TableName: TABLES.CAMERAS,
          Key: { cameraId: body.cameraId },
        })
      );
      if (!cameraResult.Item || cameraResult.Item.storeId !== storeId) {
        return error("Camera not found for this store", 404, "CAMERA_NOT_FOUND");
      }
    }

    const now = new Date().toISOString();
    const incident: Incident = {
      incidentId: uuidv4(),
      storeId,
      cameraId: body.cameraId,
      transactionId: body.transactionId,
      wasteId: body.wasteId,
      type: body.type,
      status: "open",
      title: body.title,
      notes: body.notes || "",
      timestamp: body.timestamp,
      footageStartTime: footageStart.toISOString(),
      footageEndTime: footageEnd.toISOString(),
      createdBy: user.email,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.INCIDENTS,
        Item: incident,
      })
    );

    return success(incident, 201);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("CreateIncident error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
