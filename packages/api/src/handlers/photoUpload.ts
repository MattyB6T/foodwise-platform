import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

const s3 = new S3Client({});
const BUCKET = process.env.REPORTS_BUCKET || "";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const claims = getUserClaims(event);
    const method = event.httpMethod;

    if (method === "POST") {
      if (!event.body) return error("Request body is required", 400);
      const body = JSON.parse(event.body);

      if (!body.fileName || !body.contentType) {
        return error("fileName and contentType are required", 400);
      }

      const photoId = uuidv4();
      const ext = body.fileName.split(".").pop() || "jpg";
      const key = `photos/${body.storeId || "general"}/${photoId}.${ext}`;

      // Generate presigned upload URL
      const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: body.contentType,
        Metadata: {
          uploadedBy: claims.email,
          context: body.context || "general",
          resourceId: body.resourceId || "",
        },
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

      return success({
        photoId,
        key,
        uploadUrl,
        expiresIn: 300,
      }, 201);
    }

    if (method === "GET") {
      const key = event.queryStringParameters?.key;
      if (!key) return error("key query param is required", 400);

      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
      });

      const downloadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

      return success({ downloadUrl, expiresIn: 3600 });
    }

    return error("Method not allowed", 405);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("PhotoUpload error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
