import { describe, it, expect } from "vitest";
import { success, error } from "./response";

describe("response utilities", () => {
  describe("success()", () => {
    it("returns 200 by default", () => {
      const result = success({ hello: "world" });
      expect(result.statusCode).toBe(200);
      expect(JSON.parse(result.body)).toEqual({ hello: "world" });
    });

    it("accepts custom status code", () => {
      const result = success({ id: "123" }, 201);
      expect(result.statusCode).toBe(201);
    });

    it("includes security headers", () => {
      const result = success({});
      expect(result.headers).toBeDefined();
      expect(result.headers!["X-Content-Type-Options"]).toBe("nosniff");
      expect(result.headers!["X-Frame-Options"]).toBe("DENY");
      expect(result.headers!["Strict-Transport-Security"]).toContain("max-age=");
      expect(result.headers!["Content-Type"]).toBe("application/json");
    });

    it("includes CORS headers", () => {
      const result = success({});
      expect(result.headers!["Access-Control-Allow-Origin"]).toBe("*");
      expect(result.headers!["Access-Control-Allow-Methods"]).toContain("GET");
    });

    it("serializes arrays", () => {
      const result = success([1, 2, 3]);
      expect(JSON.parse(result.body)).toEqual([1, 2, 3]);
    });

    it("serializes null", () => {
      const result = success(null);
      expect(result.body).toBe("null");
    });
  });

  describe("error()", () => {
    it("returns 400 by default", () => {
      const result = error("something went wrong");
      expect(result.statusCode).toBe(400);
      const body = JSON.parse(result.body);
      expect(body.message).toBe("something went wrong");
      expect(body.code).toBe("BAD_REQUEST");
    });

    it("accepts custom status code and error code", () => {
      const result = error("Not found", 404, "NOT_FOUND");
      expect(result.statusCode).toBe(404);
      const body = JSON.parse(result.body);
      expect(body.message).toBe("Not found");
      expect(body.code).toBe("NOT_FOUND");
    });

    it("includes security headers", () => {
      const result = error("fail");
      expect(result.headers!["X-Frame-Options"]).toBe("DENY");
    });
  });
});
