// apps/api/tests/sync-push.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { app } from "../src/app.js";
import { prisma, ensureServerUpdatedAtTriggers } from "../src/db/prisma.js";
import { signAccessToken } from "../src/auth/auth.service.js";

describe("CP23: Batch Push Endpoint (POST /sync/push) — FK Order, Idempotency, LWW & Clock Clamp", () => {
  const uniqueTag = randomUUID().slice(0, 8);
  const userAId = randomUUID();
  const userBId = randomUUID();
  const deviceId = `dev_push_${uniqueTag}`;

  const bizId = randomUUID();
  const customerId = randomUUID();
  const custEntryId = randomUUID();
  const cashEntryId = randomUUID();

  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    await ensureServerUpdatedAtTriggers(prisma);

    await prisma.user.createMany({
      data: [
        {
          id: userAId,
          email: `push_a_${uniqueTag}@hisabkhata.com`,
          name: "Merchant A",
        },
        {
          id: userBId,
          email: `push_b_${uniqueTag}@hisabkhata.com`,
          name: "Merchant B",
        },
      ],
    });

    tokenA = signAccessToken(userAId);
    tokenB = signAccessToken(userBId);
  }, 30000);

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
    await prisma.$disconnect();
  }, 30000);

  it("1. inserts all 4 tables in strict FK order and is idempotent on retry", async () => {
    const baseTs = Date.now() - 10000;

    const payload = {
      deviceId,
      changes: {
        businesses: [
          {
            id: bizId,
            name: "Saad Brothers",
            currency: "BDT",
            createdAt: baseTs,
            updatedAt: baseTs,
            isDeleted: false,
          },
        ],
        customers: [
          {
            id: customerId,
            businessId: bizId,
            name: "Younus Mg",
            phone: "01700000000",
            avatarInitials: "YM",
            createdAt: baseTs,
            updatedAt: baseTs,
            isDeleted: false,
          },
        ],
        customerEntries: [
          {
            id: custEntryId,
            businessId: bizId,
            customerId,
            type: "GOT",
            amount: "1500.50",
            details: "First payment",
            entryDate: "2026-10-30",
            entryTime: "11:00 AM",
            timestamp: baseTs,
            createdAt: baseTs,
            updatedAt: baseTs,
            isDeleted: false,
          },
        ],
        cashbookEntries: [
          {
            id: cashEntryId,
            businessId: bizId,
            type: "IN",
            paymentMode: "CASH",
            amount: "5000.00",
            details: "Opening cash",
            entryDate: "2026-10-30",
            entryTime: "09:00 AM",
            timestamp: baseTs,
            createdAt: baseTs,
            updatedAt: baseTs,
            isDeleted: false,
          },
        ],
      },
    };

    // First push
    const res1 = await request(app)
      .post("/sync/push")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("Idempotency-Key", randomUUID())
      .send(payload);

    expect(res1.status).toBe(200);
    expect(res1.body.accepted.businesses).toEqual([bizId]);
    expect(res1.body.accepted.customers).toEqual([customerId]);
    expect(res1.body.accepted.customerEntries).toEqual([custEntryId]);
    expect(res1.body.accepted.cashbookEntries).toEqual([cashEntryId]);
    expect(res1.body.rejectedConflicts.customerEntries).toHaveLength(0);

    // Second identical push (Idempotent network retry with exact same updatedAt)
    const res2 = await request(app)
      .post("/sync/push")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("Idempotency-Key", randomUUID())
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.body.accepted.customerEntries).toEqual([custEntryId]);
    expect(res2.body.rejectedConflicts.customerEntries).toHaveLength(0);
  }, 30000);

  it("2. resolves Last-Write-Wins (LWW) conflicts and clamps future client timestamps", async () => {
    const serverNow = Date.now();
    const oneHourInFuture = serverNow + 60 * 60 * 1000; // +1 hour drift

    // Push an update with a future clock (+1 hour); server must clamp it to ~serverNow
    const newerUpdateRes = await request(app)
      .post("/sync/push")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        deviceId,
        changes: {
          businesses: [],
          customers: [],
          customerEntries: [
            {
              id: custEntryId,
              businessId: bizId,
              customerId,
              type: "GOT",
              amount: "2500.00",
              details: "Updated amount",
              entryDate: "2026-10-30",
              entryTime: "11:00 AM",
              timestamp: serverNow,
              createdAt: serverNow - 10000,
              updatedAt: oneHourInFuture,
              isDeleted: false,
            },
          ],
          cashbookEntries: [],
        },
      });

    expect(newerUpdateRes.status).toBe(200);
    expect(newerUpdateRes.body.accepted.customerEntries).toEqual([custEntryId]);

    // Verify in DB that updatedAt was clamped and NOT set 1 hour in the future
    const dbRow = await prisma.customerEntry.findUniqueOrThrow({
      where: { id: custEntryId },
    });
    expect(Number(dbRow.updatedAt)).toBeLessThanOrEqual(Date.now() + 5000);

    // Now push a stale update with an older updatedAt (serverNow - 50000)
    const staleUpdateRes = await request(app)
      .post("/sync/push")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        deviceId,
        changes: {
          businesses: [],
          customers: [],
          customerEntries: [
            {
              id: custEntryId,
              businessId: bizId,
              customerId,
              type: "GOT",
              amount: "999.00",
              details: "Stale offline edit",
              entryDate: "2026-10-30",
              entryTime: "11:00 AM",
              timestamp: serverNow - 50000,
              createdAt: serverNow - 50000,
              updatedAt: serverNow - 50000,
              isDeleted: false,
            },
          ],
          cashbookEntries: [],
        },
      });

    expect(staleUpdateRes.status).toBe(200);
    expect(staleUpdateRes.body.accepted.customerEntries).toHaveLength(0);
    expect(staleUpdateRes.body.rejectedConflicts.customerEntries).toHaveLength(
      1,
    );
    expect(
      staleUpdateRes.body.rejectedConflicts.customerEntries[0].amount,
    ).toBe("2500.00");
  }, 30000);

  it("3. blocks User B with 403 Forbidden from pushing entries into User A's businessId", async () => {
    const crossUserRes = await request(app)
      .post("/sync/push")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({
        deviceId: "hacker_device",
        changes: {
          businesses: [],
          customers: [],
          customerEntries: [],
          cashbookEntries: [
            {
              id: randomUUID(),
              businessId: bizId, // Belongs to User A!
              type: "OUT",
              paymentMode: "CASH",
              amount: "100.00",
              details: "Unauthorized injection",
              entryDate: "2026-10-30",
              entryTime: "12:00 PM",
              timestamp: Date.now(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              isDeleted: false,
            },
          ],
        },
      });

    expect(crossUserRes.status).toBe(403);
    expect(crossUserRes.body.error).toBe("FORBIDDEN");
  }, 30000);
});
