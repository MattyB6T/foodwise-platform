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
    const path = event.path || "";
    // Parse path segments after /timeclock/  e.g. /stores/abc/timeclock/entry123/approve
    const timeclockIdx = path.indexOf("/timeclock");
    const subPath = timeclockIdx >= 0 ? path.slice(timeclockIdx + "/timeclock".length) : "";
    const segments = subPath.split("/").filter(Boolean); // e.g. ["entry123", "approve"] or ["live"]
    const entryId = segments.length >= 1 && segments[0] !== "live" && segments[0] !== "export" ? segments[0] : undefined;
    const action = segments.length >= 2 ? segments[1] : segments[0]; // "approve", "photo", "live", "export"

    // GET /stores/{storeId}/timeclock/live
    if (method === "GET" && action === "live") {
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
    if (method === "GET" && action === "photo" && entryId) {
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
    if (method === "POST" && action === "approve" && entryId) {
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
    if (method === "GET" && action === "export") {
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

      // If week param is a full date (YYYY-MM-DD), query the 7-day range
      let keyExpr = "storeId = :sid";
      const exprValues: Record<string, any> = { ":sid": storeId };

      if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
        const weekEnd = new Date(week);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndStr = weekEnd.toISOString().split("T")[0];
        keyExpr = "storeId = :sid AND clockInTime BETWEEN :start AND :end";
        exprValues[":start"] = week + "T00:00:00.000Z";
        exprValues[":end"] = weekEndStr + "T00:00:00.000Z";
      } else if (week) {
        keyExpr = "storeId = :sid AND begins_with(clockInTime, :week)";
        exprValues[":week"] = week;
      }

      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLES.TIME_CLOCK,
          IndexName: "storeId-clockInTime-index",
          KeyConditionExpression: keyExpr,
          ExpressionAttributeValues: exprValues,
          ScanIndexForward: false,
          Limit: 200,
        })
      );

      // Auto-flag entries with anomalies
      const now = Date.now();
      const MAX_SHIFT_HOURS = 12;
      const MISSED_CLOCKOUT_HOURS = 16;
      const MIN_BREAK_SHIFT_HOURS = 6;

      const entries = (result.Items || []).map((e: any) => {
        const flags: string[] = [];
        const clockIn = e.clockInTime ? new Date(e.clockInTime).getTime() : 0;
        const clockOut = e.clockOutTime ? new Date(e.clockOutTime).getTime() : 0;

        if (!e.clockOutTime) {
          // Still clocked in
          const hoursActive = (now - clockIn) / 3600000;
          if (hoursActive >= MISSED_CLOCKOUT_HOURS) {
            flags.push("Missed clock-out (active " + Math.round(hoursActive) + "h)");
          } else if (hoursActive >= MAX_SHIFT_HOURS) {
            flags.push("Long shift (" + Math.round(hoursActive) + "h and counting)");
          }
        } else {
          // Completed shift
          const shiftHours = (clockOut - clockIn) / 3600000;
          if (shiftHours >= MAX_SHIFT_HOURS) {
            flags.push("Long shift (" + shiftHours.toFixed(1) + "h)");
          }
          if (shiftHours < 0.1) {
            flags.push("Very short shift (" + Math.round(shiftHours * 60) + "min)");
          }
          if (shiftHours >= MIN_BREAK_SHIFT_HOURS && !e.totalBreakMinutes) {
            flags.push("No break logged on " + shiftHours.toFixed(1) + "h shift");
          }
        }

        return { ...e, autoFlags: flags.length > 0 ? flags : undefined };
      });

      // Group by employee
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
