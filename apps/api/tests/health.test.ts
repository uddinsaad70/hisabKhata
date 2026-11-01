// apps/api/tests/health.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { sanitizeBigIntForJson } from "../src/utils/bigintSerializer.js";

describe("CP19: Express API Health & Foundation", () => {
  it("GET /health returns 200 OK with service status and security headers", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("service", "hisabkhata-api");
    expect(typeof res.body.timestamp).toBe("number");
    // Verify Helmet security headers are active
    expect(res.headers).toHaveProperty("x-content-type-options", "nosniff");
  });

  it("Unknown route returns 404 NOT_FOUND JSON response", async () => {
    const res = await request(app).get("/non-existent-route");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: "NOT_FOUND",
      message: "The requested endpoint does not exist.",
    });
  });

  it("sanitizeBigIntForJson converts nested BigInt fields to safe JS numbers", () => {
    const input = {
      id: "biz-1",
      createdAt: BigInt(1761868800000),
      nested: [{ updatedAt: BigInt(1761868900000) }],
    };

    const output = sanitizeBigIntForJson(input);
    expect(JSON.stringify(output)).toBe(
      '{"id":"biz-1","createdAt":1761868800000,"nested":[{"updatedAt":1761868900000}]}',
    );
  });
});
