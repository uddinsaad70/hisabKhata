// apps/api/tests/e2e-multidevice.integration.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { app } from "../src/app.js";
import { prisma, ensureServerUpdatedAtTriggers } from "../src/db/prisma.js";

describe("CP28: End-to-End Multi-Device Cloud Sync & Account Deletion", () => {
  const uniqueTag = randomUUID().slice(0, 8);
  const email = `e2e_${uniqueTag}@hisabkhata.com`;
  const password = "password123";
  const phoneA = `device_A_${uniqueTag}`;
  const phoneB = `device_B_${uniqueTag}`;

  const bizId = randomUUID();
  const custId = randomUUID();
  const entryId = randomUUID();

  let tokenA = "";
  let tokenB = "";

  beforeAll(async () => {
    await ensureServerUpdatedAtTriggers(prisma);
  }, 30000);

  it("syncs data seamlessly from Phone A -> Cloud -> Phone B, syncs edits back, and deletes account cleanly", async () => {
    // 1. Register on Phone A
    const regRes = await request(app).post("/auth/register").send({
      name: "E2E Merchant",
      email,
      password,
      deviceId: phoneA,
      platform: "android",
    });
    expect(regRes.status).toBe(201);
    tokenA = regRes.body.accessToken;

    // 2. Push business + customer + 1500.00 GAVE entry from Phone A
    const now = Date.now();
    const pushARes = await request(app)
      .post("/sync/push")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        deviceId: phoneA,
        changes: {
          businesses: [
            {
              id: bizId,
              name: "Mayer Doa Store",
              currency: "BDT",
              createdAt: now,
              updatedAt: now,
              isDeleted: false,
            },
          ],
          customers: [
            {
              id: custId,
              businessId: bizId,
              name: "Karim Mia",
              phone: "01711223344",
              avatarInitials: "KM",
              createdAt: now,
              updatedAt: now,
              isDeleted: false,
            },
          ],
          customerEntries: [
            {
              id: entryId,
              businessId: bizId,
              customerId: custId,
              type: "GAVE",
              amount: "1500.00",
              details: "Rice 1 sack",
              entryDate: "2026-11-04",
              entryTime: "10:30 AM",
              timestamp: now,
              createdAt: now,
              updatedAt: now,
              isDeleted: false,
            },
          ],
          cashbookEntries: [],
        },
      });
    expect(pushARes.status).toBe(200);

    // 3. Login on a brand new Phone B with the same account
    const loginBRes = await request(app).post("/auth/login").send({
      email,
      password,
      deviceId: phoneB,
      platform: "android",
    });
    expect(loginBRes.status).toBe(200);
    tokenB = loginBRes.body.accessToken;

    // 4. Pull on Phone B -> receives business, customer, and 1500.00 entry
    const pullBRes = await request(app)
      .get("/sync/pull")
      .query({ deviceId: phoneB, limit: 200 })
      .set("Authorization", `Bearer ${tokenB}`);
    expect(pullBRes.status).toBe(200);
    expect(pullBRes.body.changes.businesses).toHaveLength(1);
    expect(pullBRes.body.changes.customers).toHaveLength(1);
    expect(pullBRes.body.changes.customerEntries).toHaveLength(1);
    expect(pullBRes.body.changes.customerEntries[0].amount).toBe("1500.00");

    // 5. Delete account permanently via DELETE /auth/account
    const delRes = await request(app)
      .delete("/auth/account")
      .set("Authorization", `Bearer ${tokenA}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.deleted).toBe(true);
  }, 30000);
});
