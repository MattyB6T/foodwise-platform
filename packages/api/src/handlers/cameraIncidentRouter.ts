import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { handler as registerCameraHandler } from "./registerCamera";
import { handler as listCamerasHandler } from "./listCameras";
import { handler as getCameraFootageHandler } from "./getCameraFootage";
import { handler as createIncidentHandler } from "./createIncident";
import { handler as listIncidentsHandler } from "./listIncidents";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const method = event.httpMethod;
  const resource = event.resource || "";
  const path = event.path || "";

  // GET /stores/{storeId}/cameras/{cameraId}/footage
  if (
    method === "GET" &&
    (resource.includes("/cameras/{cameraId}/footage") ||
      /\/stores\/[^/]+\/cameras\/[^/]+\/footage/.test(path))
  ) {
    return getCameraFootageHandler(event);
  }

  // POST /stores/{storeId}/cameras
  if (
    method === "POST" &&
    (resource.endsWith("/cameras") || /\/stores\/[^/]+\/cameras$/.test(path))
  ) {
    return registerCameraHandler(event);
  }

  // GET /stores/{storeId}/cameras
  if (
    method === "GET" &&
    (resource.endsWith("/cameras") || /\/stores\/[^/]+\/cameras$/.test(path))
  ) {
    return listCamerasHandler(event);
  }

  // POST /stores/{storeId}/incidents
  if (
    method === "POST" &&
    (resource.endsWith("/incidents") ||
      /\/stores\/[^/]+\/incidents$/.test(path))
  ) {
    return createIncidentHandler(event);
  }

  // GET /stores/{storeId}/incidents
  if (
    method === "GET" &&
    (resource.endsWith("/incidents") ||
      /\/stores\/[^/]+\/incidents$/.test(path))
  ) {
    return listIncidentsHandler(event);
  }

  return {
    statusCode: 404,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify({ message: "Camera/incident route not found" }),
  };
};
