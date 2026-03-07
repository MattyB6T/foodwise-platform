import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminGetUserCommand,
  AdminListGroupsForUserCommand,
  AdminDeleteUserCommand,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { PutCommand, QueryCommand, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { requireRole, isErrorResult, Role } from "../utils/roles";

const cognito = new CognitoIdentityProviderClient({ region: "us-east-1" });
const USER_POOL_ID = process.env.USER_POOL_ID!;

const VALID_ROLES: Role[] = ["owner", "manager", "staff", "readonly"];

interface InviteBody {
  email: string;
  name: string;
  role: Role;
  phone?: string;
  hourlyRate?: number;
}

interface UpdateRoleBody {
  role: Role;
}

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const path = event.path || "";
    const method = event.httpMethod || "";
    const storeId = event.pathParameters?.storeId;
    // Extract staffId from path: /stores/{storeId}/staff/{staffId}/role or /deactivate
    const staffMatch = path.match(/\/staff\/([^/]+)\/(role|deactivate)/);
    const staffId = staffMatch?.[1] || event.pathParameters?.staffId;

    if (!storeId) return error("storeId is required", 400);

    // POST /stores/{storeId}/invite - Invite a new user
    if (path.endsWith("/invite") && method === "POST") {
      return handleInvite(event, storeId);
    }

    // PUT /stores/{storeId}/staff/{staffId}/role - Update user role
    if (path.endsWith("/role") && method === "PUT" && staffId) {
      return handleRoleUpdate(event, storeId, staffId);
    }

    // GET /stores/{storeId}/team - List team with Cognito status
    if (path.endsWith("/team") && method === "GET") {
      return handleListTeam(event, storeId);
    }

    // DELETE /stores/{storeId}/staff/{staffId}/deactivate - Deactivate user
    if (path.endsWith("/deactivate") && method === "POST" && staffId) {
      return handleDeactivate(event, storeId, staffId);
    }

    return error("Route not found", 404);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("UserManagement error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};

async function handleInvite(
  event: APIGatewayProxyEvent,
  storeId: string
): Promise<APIGatewayProxyResult> {
  const auth = requireRole(event, "manager");
  if (isErrorResult(auth)) return auth;

  if (!event.body) return error("Request body is required", 400);
  const body: InviteBody = JSON.parse(event.body);

  if (!body.email || !body.name || !body.role) {
    return error("email, name, and role are required", 400);
  }
  if (!VALID_ROLES.includes(body.role)) {
    return error("role must be owner, manager, staff, or readonly", 400);
  }
  // Only owners can create owners or managers
  if ((body.role === "owner" || body.role === "manager") && auth.role !== "owner") {
    return error("Only owners can assign owner or manager roles", 403);
  }

  const email = body.email.toLowerCase().trim();

  // Step 1: Create Cognito user (sends invitation email with temp password)
  let cognitoSub: string;
  try {
    const createResult = await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
        ],
        DesiredDeliveryMediums: ["EMAIL"],
      })
    );
    cognitoSub = createResult.User?.Attributes?.find((a) => a.Name === "sub")?.Value || "";
  } catch (err: any) {
    if (err.name === "UsernameExistsException") {
      // User already exists in Cognito - get their sub and continue to add staff record
      try {
        const existing = await cognito.send(
          new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email })
        );
        cognitoSub = existing.UserAttributes?.find((a) => a.Name === "sub")?.Value || "";
      } catch {
        return error("User exists but could not retrieve details", 500);
      }
    } else {
      console.error("Cognito create user error:", err);
      return error(`Failed to create user: ${err.message}`, 500);
    }
  }

  // Step 2: Add user to Cognito group
  try {
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: body.role,
      })
    );
  } catch (err: any) {
    console.error("Add to group error:", err);
    // Don't fail the whole operation - staff record is still useful
  }

  // Step 3: Create staff record in DynamoDB
  const now = new Date().toISOString();
  const newStaffId = uuidv4();

  const staffRecord = {
    staffId: newStaffId,
    storeId,
    email,
    name: body.name,
    role: body.role,
    phone: body.phone || null,
    hourlyRate: body.hourlyRate ?? null,
    cognitoSub: cognitoSub || null,
    active: true,
    createdBy: auth.claims.email,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({ TableName: TABLES.STAFF, Item: staffRecord })
  );

  return success(
    {
      message: `Invitation sent to ${email}`,
      staffId: newStaffId,
      email,
      role: body.role,
    },
    201
  );
}

async function handleRoleUpdate(
  event: APIGatewayProxyEvent,
  storeId: string,
  staffId: string
): Promise<APIGatewayProxyResult> {
  const auth = requireRole(event, "manager");
  if (isErrorResult(auth)) return auth;

  if (!event.body) return error("Request body is required", 400);
  const body: UpdateRoleBody = JSON.parse(event.body);

  if (!body.role || !VALID_ROLES.includes(body.role)) {
    return error("Valid role is required (owner, manager, staff, readonly)", 400);
  }

  // Only owners can assign owner/manager roles
  if ((body.role === "owner" || body.role === "manager") && auth.role !== "owner") {
    return error("Only owners can assign owner or manager roles", 403);
  }

  // Get existing staff record
  const existing = await docClient.send(
    new GetCommand({ TableName: TABLES.STAFF, Key: { staffId } })
  );
  if (!existing.Item || existing.Item.storeId !== storeId) {
    return error("Staff member not found", 404);
  }

  // Can't change an owner's role unless you're an owner
  if (existing.Item.role === "owner" && auth.role !== "owner") {
    return error("Only owners can change an owner's role", 403);
  }

  const oldRole = existing.Item.role;
  const email = existing.Item.email;

  // Step 1: Update Cognito groups - remove old, add new
  try {
    // Remove from old group
    await cognito.send(
      new AdminRemoveUserFromGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: oldRole,
      })
    );
  } catch {
    // May not be in old group - that's OK
  }

  try {
    // Add to new group
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: body.role,
      })
    );
  } catch (err: any) {
    console.error("Cognito group update error:", err);
    // Continue - update staff record anyway
  }

  // Step 2: Update staff record
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.STAFF,
      Key: { staffId },
      UpdateExpression: "SET #role = :role, updatedAt = :now",
      ExpressionAttributeNames: { "#role": "role" },
      ExpressionAttributeValues: {
        ":role": body.role,
        ":now": new Date().toISOString(),
      },
    })
  );

  return success({
    message: `Role updated from ${oldRole} to ${body.role}`,
    staffId,
    email,
    oldRole,
    newRole: body.role,
  });
}

async function handleListTeam(
  event: APIGatewayProxyEvent,
  storeId: string
): Promise<APIGatewayProxyResult> {
  const auth = requireRole(event, "manager");
  if (isErrorResult(auth)) return auth;

  // Get all staff for this store
  const staffResult = await docClient.send(
    new QueryCommand({
      TableName: TABLES.STAFF,
      IndexName: "storeId-index",
      KeyConditionExpression: "storeId = :sid",
      ExpressionAttributeValues: { ":sid": storeId },
    })
  );

  const staff = staffResult.Items || [];

  // Sort: owners first, then managers, then staff, then readonly
  const roleOrder: Record<string, number> = { owner: 0, manager: 1, staff: 2, readonly: 3 };
  staff.sort((a: any, b: any) => (roleOrder[a.role] ?? 4) - (roleOrder[b.role] ?? 4));

  return success({
    storeId,
    totalMembers: staff.length,
    members: staff.map((s: any) => ({
      staffId: s.staffId,
      email: s.email,
      name: s.name,
      role: s.role,
      phone: s.phone,
      hourlyRate: auth.role === "owner" || auth.role === "manager" ? s.hourlyRate : undefined,
      active: s.active,
      createdAt: s.createdAt,
    })),
  });
}

async function handleDeactivate(
  event: APIGatewayProxyEvent,
  storeId: string,
  staffId: string
): Promise<APIGatewayProxyResult> {
  const auth = requireRole(event, "manager");
  if (isErrorResult(auth)) return auth;

  const existing = await docClient.send(
    new GetCommand({ TableName: TABLES.STAFF, Key: { staffId } })
  );
  if (!existing.Item || existing.Item.storeId !== storeId) {
    return error("Staff member not found", 404);
  }

  if (existing.Item.role === "owner" && auth.role !== "owner") {
    return error("Only owners can deactivate owners", 403);
  }
  if (existing.Item.email === auth.claims.email) {
    return error("Cannot deactivate yourself", 400);
  }

  // Mark inactive in staff table
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.STAFF,
      Key: { staffId },
      UpdateExpression: "SET active = :inactive, updatedAt = :now",
      ExpressionAttributeValues: {
        ":inactive": false,
        ":now": new Date().toISOString(),
      },
    })
  );

  return success({ message: "User deactivated", staffId });
}
