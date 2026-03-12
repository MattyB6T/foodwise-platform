import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESClient({});

const TABLE_NAME = process.env.WAITLIST_TABLE!;
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@leantable.app";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Request body is required" }),
      };
    }

    const { email } = JSON.parse(event.body) as { email?: string };

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Valid email is required" }),
      };
    }

    const now = new Date().toISOString();

    // Store in DynamoDB
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          email: email.toLowerCase().trim(),
          signedUpAt: now,
          source: "landing-page",
        },
        ConditionExpression: "attribute_not_exists(email)",
      })
    ).catch((err) => {
      // Silently ignore duplicate — they're already on the list
      if (err.name !== "ConditionalCheckFailedException") throw err;
    });

    // Send notification email if configured
    if (NOTIFY_EMAIL) {
      await ses.send(
        new SendEmailCommand({
          Source: FROM_EMAIL,
          Destination: { ToAddresses: [NOTIFY_EMAIL] },
          Message: {
            Subject: { Data: `New LeanTable Waitlist Signup: ${email}` },
            Body: {
              Text: {
                Data: `New waitlist signup!\n\nEmail: ${email}\nTime: ${now}\nSource: Landing page`,
              },
            },
          },
        })
      ).catch((err) => {
        // Don't fail the request if email notification fails
        console.error("SES notification failed:", err.message);
      });
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Success" }),
    };
  } catch (err: any) {
    console.error("Waitlist error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Something went wrong. Please try again." }),
    };
  }
};
