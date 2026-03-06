import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    getUserClaims(event);

    const storeId = event.pathParameters?.storeId;
    const cameraId = event.pathParameters?.cameraId;

    if (!storeId || !cameraId) {
      return error("storeId and cameraId are required", 400);
    }

    const startTime = event.queryStringParameters?.startTime;
    const endTime = event.queryStringParameters?.endTime;

    if (!startTime || !endTime) {
      return error("startTime and endTime query parameters are required", 400);
    }

    // Fetch camera record
    const cameraResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.CAMERAS,
        Key: { cameraId },
      })
    );

    if (!cameraResult.Item) {
      return error("Camera not found", 404, "CAMERA_NOT_FOUND");
    }

    const camera = cameraResult.Item;

    if (camera.storeId !== storeId) {
      return error("Camera does not belong to this store", 403, "FORBIDDEN");
    }

    // Build Wyze API playback request
    // In production, this would call the Wyze API to get a signed playback URL
    // For now, we return the request parameters so the client can use them
    const footageRequest = {
      cameraId,
      cameraName: camera.name,
      location: camera.location,
      wyzeDeviceId: camera.wyzeDeviceId,
      wyzeDeviceMac: camera.wyzeDeviceMac,
      startTime,
      endTime,
      // Wyze API would return a signed HLS stream URL here
      // This is a placeholder that the mobile app will use to request playback
      playbackUrl: camera.streamUrl || null,
      status: camera.isOnline ? "available" : "camera_offline",
    };

    return success(footageRequest);
  } catch (err) {
    console.error("GetCameraFootage error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
