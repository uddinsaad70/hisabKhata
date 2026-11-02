// apps/api/tests/docs.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("CP25: OpenAPI 3.1 Spec & Swagger UI (/docs)", () => {
  it("GET /docs/openapi.json returns valid OpenAPI 3.1.0 specification with all routes", async () => {
    const res = await request(app).get("/docs/openapi.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(res.body.info.title).toBe("HisabKhata Cloud Sync API");
    expect(res.body.paths).toHaveProperty("/health");
    expect(res.body.paths).toHaveProperty("/auth/register");
    expect(res.body.paths).toHaveProperty("/auth/login");
    expect(res.body.paths).toHaveProperty("/sync/push");
    expect(res.body.paths).toHaveProperty("/sync/pull");
  });

  it("GET /docs serves the Swagger UI HTML page", async () => {
    const res = await request(app).get("/docs");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("SwaggerUIBundle");
  });
});
