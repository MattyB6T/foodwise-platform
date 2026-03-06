import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, GetCommand, UpdateCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { requireRole, isErrorResult, Role } from "../utils/roles";

interface StaffBody {
  email: string;
  name: string;
  role: Role;
  phone?: string;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const storeId = event.pathParameters?.storeId;
    const staffId = event.pathParameters?.staffId;
    if (!storeId) return error("storeId is required", 400);

    const method = event.httpMethod;

    if (method === "POST") {
      const auth = requireRole(event, "manager");
      if (isErrorResult(auth)) return auth;

      if (!event.body) return error("Request body is required", 400);
      const body: StaffBody = JSON.parse(event.body);

      if (!body.email || !body.name || !body.role) {
        return error("email, name, and role are required", 400);
      }

      const validRoles: Role[] = ["manager", "staff", "readonly"];
      if (!validRoles.includes(body.role)) {
        return error("role must be manager, staff, or readonly", 400);
      }

      // Only owners can create managers
      if (body.role === "manager" && auth.role !== "owner") {
        return error("Only owners can assign manager role", 403);
      }

      const now = new Date().toISOString();
      const newStaffId = uuidv4();

      const staffRecord = {
        staffId: newStaffId,
        storeId,
        email: body.email,
        name: body.name,
        role: body.role,
        phone: body.phone || null,
        active: true,
        createdBy: auth.claims.email,
        createdAt: now,
        updatedAt: now,
      };

      await docClient.send(
        new PutCommand({
          TableName: TABLES.STAFF,
          Item: staffRecord,
        })
      );

      return success(staffRecord, 201);
    }

    if (method === "PUT" && staffId) {
      const auth = requireRole(event, "manager");
      if (isErrorResult(auth)) return auth;

      if (!event.body) return error("Request body is required", 400);
      const body = JSON.parse(event.body);

      const existing = await docClient.send(
        new GetCommand({
          TableName: TABLES.STAFF,
          Key: { staffId },
        })
      );

      if (!existing.Item || existing.Item.storeId !== storeId) {
        return error("Staff member not found", 404);
      }

      // Only owners can change role to manager
      if (body.role === "manager" && auth.role !== "owner") {
        return error("Only owners can assign manager role", 403);
      }

      const updates: string[] = ["updatedAt = :now"];
      const values: Record<string, any> = { ":now": new Date().toISOString() };

      if (body.name) { updates.push("#name = :name"); values[":name"] = body.name; }
      if (body.role) { updates.push("#role = :role"); values[":role"] = body.role; }
      if (body.phone !== undefined) { updates.push("phone = :phone"); values[":phone"] = body.phone; }
      if (body.active !== undefined) { updates.push("active = :active"); values[":active"] = body.active; }

      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.STAFF,
          Key: { staffId },
          UpdateExpression: `SET ${updates.join(", ")}`,
          ExpressionAttributeNames: {
            ...(body.name ? { "#name": "name" } : {}),
            ...(body.role ? { "#role": "role" } : {}),
          },
          ExpressionAttributeValues: values,
        })
      );

      return success({ message: "Staff member updated", staffId });
    }

    if (method === "DELETE" && staffId) {
      const auth = requireRole(event, "manager");
      if (isErrorResult(auth)) return auth;

      const existing = await docClient.send(
        new GetCommand({
          TableName: TABLES.STAFF,
          Key: { staffId },
        })
      );

      if (!existing.Item || existing.Item.storeId !== storeId) {
        return error("Staff member not found", 404);
      }

      // Can't delete someone with higher role
      if (existing.Item.role === "owner") {
        return error("Cannot remove an owner", 403);
      }
      if (existing.Item.role === "manager" && auth.role !== "owner") {
        return error("Only owners can remove managers", 403);
      }

      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.STAFF,
          Key: { staffId },
        })
      );

      return success({ message: "Staff member removed", staffId });
    }

    return error("Method not allowed", 405);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("ManageStaff error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
