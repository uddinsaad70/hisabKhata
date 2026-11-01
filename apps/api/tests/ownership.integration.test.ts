// apps/api/tests/ownership.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { randomUUID } from "crypto";
import { prisma } from "../src/db/prisma.js";
import { signAccessToken } from "../src/auth/auth.service.js";
import { authMiddleware } from "../src/middleware/authMiddleware.js";
import { requireBusinessOwnership } from "../src/middleware/ownershipMiddleware.js";

describe("CP22: JWT Auth & Business Ownership Middleware", () => {
  const uniqueTag = randomUUID().slice(0, 8);
  const ownerId = randomUUID();
  const strangerId = randomUUID();
  const businessId = randomUUID();

  let ownerToken: string;
  let strangerToken: string;

  // Dedicated Express instance so route is mounted BEFORE any 404 handler
  const testApp = express();
  testApp.use(express.json());
  testApp.post(
    "/test-protected-biz",
    authMiddleware,
    requireBusinessOwnership(),
    (_req, res) => {
      res.status(200).json({ success: true });
    },
  );

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          email: `owner_${uniqueTag}@hisabkhata.com`,
          name: "Owner User",
        },
        {
          id: strangerId,
          email: `stranger_${uniqueTag}@hisabkhata.com`,
          name: "Stranger User",
        },
      ],
    });

    await prisma.business.create({
      data: {
        id: businessId,
        ownerUserId: ownerId,
        name: "Owner's Shop",
        currency: "BDT",
        createdAt: BigInt(Date.now()),
        updatedAt: BigInt(Date.now()),
      },
    });

    ownerToken = signAccessToken(ownerId);
    strangerToken = signAccessToken(strangerId);
  }, 30000);

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, strangerId] } },
    });
    await prisma.$disconnect();
  }, 30000);

  it("allows access when owner sends valid token and their own businessId", async () => {
    const res = await request(testApp)
      .post("/test-protected-biz")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ businessId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("blocks access with 403 Forbidden when a stranger tries to access someone else's businessId", async () => {
    const res = await request(testApp)
      .post("/test-protected-biz")
      .set("Authorization", `Bearer ${strangerToken}`)
      .send({ businessId });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  it("blocks access with 401 Unauthorized when Authorization header is missing", async () => {
    const res = await request(testApp)
      .post("/test-protected-biz")
      .send({ businessId });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });
});
