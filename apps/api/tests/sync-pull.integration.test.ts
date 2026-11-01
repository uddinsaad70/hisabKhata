// apps/api/tests/sync-pull.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { app } from "../src/app.js";
import { prisma, ensureServerUpdatedAtTriggers } from "../src/db/prisma.js";
import { signAccessToken } from "../src/auth/auth.service.js";
import { encodePullCursor, purgeTombstones } from "../src/sync/sync.service.js";

describe("CP24: Paginated Pull (GET /sync/pull), Cursor Pagination, 410 Gone & Tombstone Purge", () => {
  const uniqueTag = randomUUID().slice(0, 8);
  const userId = randomUUID();
  const device1Id = `dev1_${uniqueTag}`;
  const device2Id = `dev2_${uniqueTag}`;

  const bizId = randomUUID();
  const customerId = randomUUID();
  const entry1Id = randomUUID();
  const entry2Id = randomUUID();
  const cashEntryId = randomUUID();

  let token: string;

  beforeAll(async () => {
    await ensureServerUpdatedAtTriggers(prisma);

    await prisma.user.create({
      data: {
        id: userId,
        email: `pull_user_${uniqueTag}@hisabkhata.com`,
        name: "Pull Tester",
      },
    });

    token = signAccessToken(userId);

    const baseTs = Date.now() - 20000;

    // Seed initial data via POST /sync/push from Device 1
    const pushRes = await request(app)
      .post("/sync/push")
      .set("Authorization", `Bearer ${token}`)
      .send({
        deviceId: device1Id,
        changes: {
          businesses: [
            {
              id: bizId,
              name: "Pull Test Shop",
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
              name: "Rahim Uddin",
              phone: "01800000000",
              avatarInitials: "RU",
              createdAt: baseTs,
              updatedAt: baseTs,
              isDeleted: false,
            },
          ],
          customerEntries: [
            {
              id: entry1Id,
              businessId: bizId,
              customerId,
              type: "GAVE",
              amount: "1000.00",
              details: "Entry 1",
              entryDate: "2026-10-30",
              entryTime: "10:00 AM",
              timestamp: baseTs,
              createdAt: baseTs,
              updatedAt: baseTs,
              isDeleted: false,
            },
            {
              id: entry2Id,
              businessId: bizId,
              customerId,
              type: "GOT",
              amount: "400.00",
              details: "Entry 2",
              entryDate: "2026-10-30",
              entryTime: "10:05 AM",
              timestamp: baseTs + 1000,
              createdAt: baseTs + 1000,
              updatedAt: baseTs + 1000,
              isDeleted: false,
            },
          ],
          cashbookEntries: [
            {
              id: cashEntryId,
              businessId: bizId,
              type: "IN",
              paymentMode: "ONLINE",
              amount: "3000.00",
              details: "bKash receive",
              entryDate: "2026-10-30",
              entryTime: "10:10 AM",
              timestamp: baseTs + 2000,
              createdAt: baseTs + 2000,
              updatedAt: baseTs + 2000,
              isDeleted: false,
            },
          ],
        },
      });

    expect(pushRes.status).toBe(200);
  }, 30000);

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { id: userId },
    });
    await prisma.$disconnect();
  }, 30000);

  it("1. pulls all 5 records across multiple pages using limit=2 in strict FK order", async () => {
    // Page 1 (limit=2): should fetch 1 business + 1 customer
    const page1 = await request(app)
      .get("/sync/pull")
      .query({ deviceId: device2Id, limit: 2 })
      .set("Authorization", `Bearer ${token}`);

    expect(page1.status).toBe(200);
    expect(page1.body.hasMore).toBe(true);
    expect(page1.body.changes.businesses).toHaveLength(1);
    expect(page1.body.changes.customers).toHaveLength(1);
    expect(page1.body.changes.customerEntries).toHaveLength(0);
    expect(typeof page1.body.nextCursor).toBe("string");

    // Page 2 (limit=2): should fetch 2 customerEntries
    const page2 = await request(app)
      .get("/sync/pull")
      .query({
        deviceId: device2Id,
        cursor: page1.body.nextCursor,
        limit: 2,
      })
      .set("Authorization", `Bearer ${token}`);

    expect(page2.status).toBe(200);
    expect(page2.body.hasMore).toBe(true);
    expect(page2.body.changes.businesses).toHaveLength(0);
    expect(page2.body.changes.customers).toHaveLength(0);
    expect(page2.body.changes.customerEntries).toHaveLength(2);

    // Page 3 (limit=2): should fetch 1 cashbookEntry and finish (hasMore = false)
    const page3 = await request(app)
      .get("/sync/pull")
      .query({
        deviceId: device2Id,
        cursor: page2.body.nextCursor,
        limit: 2,
      })
      .set("Authorization", `Bearer ${token}`);

    expect(page3.status).toBe(200);
    expect(page3.body.hasMore).toBe(false);
    expect(page3.body.changes.cashbookEntries).toHaveLength(1);

    // Verify Device 2 now catches an edit from Device 1 even if Device 1's clock is lagging behind
    const laggingClientUpdatedAt = Date.now() - 5000; // still newer than baseTs (-20000)
    const editPush = await request(app)
      .post("/sync/push")
      .set("Authorization", `Bearer ${token}`)
      .send({
        deviceId: device1Id,
        changes: {
          businesses: [],
          customers: [],
          customerEntries: [
            {
              id: entry1Id,
              businessId: bizId,
              customerId,
              type: "GAVE",
              amount: "1200.00",
              details: "Edited with lagging clock",
              entryDate: "2026-10-30",
              entryTime: "10:00 AM",
              timestamp: laggingClientUpdatedAt,
              createdAt: laggingClientUpdatedAt,
              updatedAt: laggingClientUpdatedAt,
              isDeleted: true, // Soft-delete entry1
            },
          ],
          cashbookEntries: [],
        },
      });
    expect(editPush.status).toBe(200);

    // Delta Pull on Device 2 using page3.body.nextCursor
    const deltaPull = await request(app)
      .get("/sync/pull")
      .query({
        deviceId: device2Id,
        cursor: page3.body.nextCursor,
        limit: 50,
      })
      .set("Authorization", `Bearer ${token}`);

    expect(deltaPull.status).toBe(200);
    expect(deltaPull.body.changes.customerEntries).toHaveLength(1);
    expect(deltaPull.body.changes.customerEntries[0].id).toBe(entry1Id);
    expect(deltaPull.body.changes.customerEntries[0].isDeleted).toBe(true);
  }, 30000);

  it("2. returns 410 Gone when cursor is older than 90 days", async () => {
    const ninetyOneDaysAgoIso = new Date(
      Date.now() - 91 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const expiredCursor = encodePullCursor({
      businesses: { ts: ninetyOneDaysAgoIso, id: bizId },
    });

    const res = await request(app)
      .get("/sync/pull")
      .query({
        deviceId: device2Id,
        cursor: expiredCursor,
        limit: 50,
      })
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(410);
    expect(res.body.error).toBe("CURSOR_EXPIRED_FULL_RESYNC_REQUIRED");
  }, 30000);

  it("3. safely purges tombstones only after all user devices have pulled past server_updated_at", async () => {
    // At this point, Device 2 has pulled the soft-deleted entry1, but Device 1 has NOT pulled yet.
    const purgeBeforeAllPulled = await purgeTombstones(userId);
    expect(purgeBeforeAllPulled.purgedCustomerEntries).toBe(0);

    // Wait 20ms and have Device 1 pull all changes so both Device 1 & Device 2 are caught up
    await new Promise((r) => setTimeout(r, 20));
    const dev1Pull = await request(app)
      .get("/sync/pull")
      .query({ deviceId: device1Id, limit: 100 })
      .set("Authorization", `Bearer ${token}`);
    expect(dev1Pull.status).toBe(200);

    // Now both Device 1 and Device 2 have last_pulled_at > entry1.server_updated_at!
    const purgeAfterAllPulled = await purgeTombstones(userId);
    expect(purgeAfterAllPulled.purgedCustomerEntries).toBe(1);
  }, 30000);
});
