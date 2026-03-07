import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, UpdateCommand, PutCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { docClient, TABLES } from "../utils/dynamo";
import { success, error } from "../utils/response";
import { requireRole, isErrorResult } from "../utils/roles";

const s3 = new S3Client({});
const BUCKET = process.env.REPORTS_BUCKET || "";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const storeId = event.pathParameters?.storeId;
    if (!storeId) return error("storeId is required", 400);

    const method = event.httpMethod;
    const entryId = event.pathParameters?.entryId;
    const resource = event.resource || "";

    // GET /stores/{storeId}/timeclock/live
    if (method === "GET" && resource.endsWith("/live")) {
      const auth = requireRole(event, "staff");
      if (isErrorResult(auth)) return auth;

      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLES.TIME_CLOCK,
          IndexName: "storeId-clockInTime-index",
          KeyConditionExpression: "storeId = :sid",
          ExpressionAttributeValues: { ":sid": storeId },
        })
      );

      const live = (result.Items || [])
        .filter((e: any) => !e.clockOutTime)
        .map((e: any) => {
          const clockIn = new Date(e.clockInTime);
          const now = new Date();
          const minutesOnShift = Math.round((now.getTime() - clockIn.getTime()) / 60000);
          const onBreak = (e.breakEvents || []).some((b: any) => !b.endTime);
          return {
            entryId: e.entryId,
            staffId: e.staffId,
            staffName: e.staffName,
            clockInTime: e.clockInTime,
            minutesOnShift,
            onBreak,
            flagged: e.flagged,
          };
        });

      return success({ live, count: live.length });
    }

    // GET /stores/{storeId}/timeclock/{entryId}/photo
    if (method === "GET" && resource.endsWith("/photo") && entryId) {
      const auth = requireRole(event, "manager");
      if (isErrorResult(auth)) return auth;

      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLES.TIME_CLOCK,
          IndexName: "storeId-clockInTime-index",
          KeyConditionExpression: "storeId = :sid",
          FilterExpression: "entryId = :eid",
          ExpressionAttributeValues: { ":sid": storeId, ":eid": entryId },
        })
      );

      const entry = result.Items?.[0];
      if (!entry) return error("Entry not found", 404);
      if (!entry.clockInPhotoKey) return error("No photo for this entry", 404);

      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: entry.clockInPhotoKey }),
        { expiresIn: 3600 }
      );

      return success({ photoUrl: url, expiresIn: 3600 });
    }

    // POST /stores/{storeId}/timeclock/{entryId}/approve
    if (method === "POST" && resource.endsWith("/approve") && entryId) {
      const auth = requireRole(event, "manager");
      if (isErrorResult(auth)) return auth;

      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.TIME_CLOCK,
          Key: { entryId },
          UpdateExpression: "SET managerApproved = :approved, approvedBy = :by, approvedAt = :at",
          ExpressionAttributeValues: {
            ":approved": true,
            ":by": auth.claims.email,
            ":at": new Date().toISOString(),
          },
        })
      );

      return success({ message: "Entry approved", entryId });
    }

    // PUT /stores/{storeId}/timeclock/{entryId}
    if (method === "PUT" && entryId) {
      const auth = requireRole(event, "manager");
      if (isErrorResult(auth)) return auth;

      if (!event.body) return error("Request body is required", 400);
      const body = JSON.parse(event.body);

      if (!body.reason) return error("reason is required for time edits", 400);

      const updates: string[] = [];
      const values: Record<string, any> = {};
      const names: Record<string, string> = {};

      if (body.clockInTime) { updates.push("clockInTime = :cin"); values[":cin"] = body.clockInTime; }
      if (body.clockOutTime) { updates.push("clockOutTime = :cout"); values[":cout"] = body.clockOutTime; }
      if (body.notes !== undefined) { updates.push("notes = :notes"); values[":notes"] = body.notes; }
      if (body.flagged !== undefined) { updates.push("flagged = :flag"); values[":flag"] = body.flagged; }

      if (updates.length === 0) return error("No fields to update", 400);

      updates.push("editedBy = :editBy");
      updates.push("editedAt = :editAt");
      values[":editBy"] = auth.claims.email;
      values[":editAt"] = new Date().toISOString();

      await docClient.send(
        new UpdateCommand({
          TableName: TABLES.TIME_CLOCK,
          Key: { entryId },
          UpdateExpression: `SET ${updates.join(", ")}`,
          ExpressionAttributeValues: values,
          ...(Object.keys(names).length > 0 ? { ExpressionAttributeNames: names } : {}),
        })
      );

      // Log edit to audit trail
      await docClient.send(
        new PutCommand({
          TableName: TABLES.AUDIT_TRAIL,
          Item: {
            auditId: uuidv4(),
            storeId,
            action: "EDIT_TIMECLOCK",
            resourceType: "timeclock",
            resourceId: entryId,
            performedBy: auth.claims.email,
            details: { reason: body.reason, changes: body },
            timestamp: new Date().toISOString(),
          },
        })
      );

      return success({ message: "Entry updated", entryId });
    }

    // GET /stores/{storeId}/timeclock/export
    if (method === "GET" && resource.endsWith("/export")) {
      const auth = requireRole(event, "manager");
      if (isErrorResult(auth)) return auth;

      const week = event.queryStringParameters?.week;

      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLES.TIME_CLOCK,
          IndexName: "storeId-clockInTime-index",
          KeyConditionExpression: week
            ? "storeId = :sid AND begins_with(clockInTime, :week)"
            : "storeId = :sid",
          ExpressionAttributeValues: week
            ? { ":sid": storeId, ":week": week }
            : { ":sid": storeId },
          ScanIndexForward: true,
        })
      );

      const entries = result.Items || [];

      // Build CSV
      const header = "Employee,Date,Clock In,Clock Out,Hours,Break (min),Flagged,Approved";
      const rows = entries.map((e: any) => {
        const date = e.clockInTime?.split("T")[0] || "";
        const cin = e.clockInTime ? new Date(e.clockInTime).toLocaleTimeString() : "";
        const cout = e.clockOutTime ? new Date(e.clockOutTime).toLocaleTimeString() : "Active";
        return `${e.staffName},${date},${cin},${cout},${e.totalHours ?? ""},${e.totalBreakMinutes ?? ""},${e.flagged ? "Yes" : "No"},${e.managerApproved ? "Yes" : "No"}`;
      });

      return success({ csv: [header, ...rows].join("\n"), entries });
    }

    // GET /stores/{storeId}/timeclock?week=YYYY-MM-DD (default)
    if (method === "GET") {
      const auth = requireRole(event, "staff");
      if (isErrorResult(auth)) return auth;

      const week = event.queryStringParameters?.week;

      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLES.TIME_CLOCK,
          IndexName: "storeId-clockInTime-index",
          KeyConditionExpression: week
            ? "storeId = :sid AND begins_with(clockInTime, :week)"
            : "storeId = :sid",
          ExpressionAttributeValues: week
            ? { ":sid": storeId, ":week": week }
            : { ":sid": storeId },
          ScanIndexForward: false,
          Limit: 200,
        })
      );

      // Group by employee
      const entries = result.Items || [];
      const byEmployee: Record<string, any> = {};
      for (const e of entries) {
        if (!byEmployee[e.staffId]) {
          byEmployee[e.staffId] = { staffId: e.staffId, staffName: e.staffName, entries: [], totalHours: 0 };
        }
        byEmployee[e.staffId].entries.push(e);
        byEmployee[e.staffId].totalHours += e.totalHours || 0;
      }

      // If caller is manager+, enrich with labor cost from staff hourly rates
      const isManager = auth.role === "manager" || auth.role === "owner";
      let totalLaborCost = 0;

      if (isManager) {
        const staffIds = Object.keys(byEmployee);
        if (staffIds.length > 0) {
          // Batch get staff records for hourly rates (max 100 at a time)
          const batchKeys = staffIds.map((id) => ({ staffId: id }));
          const batchRes = await docClient.send(
            new BatchGetCommand({
              RequestItems: {
                [TABLES.STAFF]: { Keys: batchKeys },
              },
            })
          );
          const staffRecords = batchRes.Responses?.[TABLES.STAFF] || [];
          const rateMap: Record<string, number> = {};
          for (const s of staffRecords) {
            if (s.hourlyRate) rateMap[s.staffId] = s.hourlyRate;
          }

          for (const emp of Object.values(byEmployee)) {
            const rate = rateMap[emp.staffId] || 0;
            emp.hourlyRate = rate;
            emp.laborCost = Math.round(emp.totalHours * rate * 100) / 100;
            totalLaborCost += emp.laborCost;
          }
        }
      }

      return success({
        employees: Object.values(byEmployee),
        totalEntries: entries.length,
        ...(isManager ? { totalLaborCost: Math.round(totalLaborCost * 100) / 100 } : {}),
      });
    }

    return error("Method not allowed", 405);
  } catch (err) {
    if (err instanceof SyntaxError) return error("Invalid JSON", 400);
    console.error("TimesheetManagement error:", err);
    return error("Internal server error", 500, "INTERNAL_ERROR");
  }
};
