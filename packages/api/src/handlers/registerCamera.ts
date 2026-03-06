import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { Camera, CameraLocation } from "@foodwise/shared";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

interface RegisterCameraBody {
  name: string;
  location: CameraLocation;
  wyzeDeviceId: string;
  wyzeDeviceMac: string;
}

const VALID_LOCATIONS: CameraLocation[] = [
  "register",
  "prep-area",
  "drive-thru",
  "storage",
  "dining",
  "entrance",
];

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const storeId = event.pathParameters?.storeId;
    if (!storeId) {
      return error("storeId is required", 400);
    }

    if (!event.body) {
      return error("Request body is required", 400);
    }

    const body: RegisterCameraBody = JSON.parse(event.body);

    if (!body.name || !body.location || !body.wyzeDeviceId || !body.wyzeDeviceMac) {
      return error("name, location, wyzeDeviceId, and wyzeDeviceMac are required", 400);
    }

    if (!VALID_LOCATIONS.includes(body.location)) {
      return error(`location must be one of: ${VALID_LOCATIONS.join(", ")}`, 400);
    }

    const now = new Date().toISOString();
    const camera: Camera = {
      cameraId: uuidv4(),
      storeId,
      name: body.name,
      location: body.location,
      wyzeDeviceId: body.wyzeDeviceId,
      wyzeDeviceMac: body.wyzeDeviceMac,
      isOnline: true,
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.CAMERAS,
        Item: camera,
      })
    );

    return success(camera, 201);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return error("Invalid JSON in request body", 400);
    }
    console.error("RegisterCamera error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
