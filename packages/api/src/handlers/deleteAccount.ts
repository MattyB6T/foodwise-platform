import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { QueryCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { getUserClaims } from "../utils/auth";

const cognito = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID || "";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const user = getUserClaims(event);

    // Delete staff records across all stores
    const staffResult = await docClient.send(
      new ScanCommand({
        TableName: TABLES.STAFF,
        FilterExpression: "email = :email",
        ExpressionAttributeValues: { ":email": user.email },
      })
    );
    for (const staff of staffResult.Items || []) {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.STAFF,
          Key: { staffId: staff.staffId },
        })
      );
    }

    // Delete notification registrations
    const notifResult = await docClient.send(
      new QueryCommand({
        TableName: TABLES.NOTIFICATIONS,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": user.sub },
      })
    );
    for (const notif of notifResult.Items || []) {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLES.NOTIFICATIONS,
          Key: { userId: notif.userId, token: notif.token },
        })
      );
    }

    // Delete the Cognito user
    if (USER_POOL_ID) {
      try {
        await cognito.send(
          new AdminDeleteUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: user.email,
          })
        );
      } catch (cognitoErr: any) {
        console.error("Cognito delete error:", cognitoErr);
        // Continue even if Cognito delete fails — user can contact support
      }
    }

    console.log(`Account deleted: ${user.email} (${user.sub})`);

    return success({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("DeleteAccount error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
