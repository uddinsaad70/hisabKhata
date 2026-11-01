// apps/api/tests/schema.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { prisma, ensureServerUpdatedAtTriggers } from "../src/db/prisma.js";

describe("CP20: PostgreSQL Prisma Schema & server_updated_at Trigger", () => {
  const testUserId = randomUUID();
  const testBusinessId = randomUUID();
  const testCustomerId = randomUUID();
  const testEntryId = randomUUID();

  beforeAll(async () => {
    // Ensure PL/pgSQL triggers are installed on the database
    await ensureServerUpdatedAtTriggers(prisma);
  }, 30000);

  afterAll(async () => {
    // Clean up test user (cascades to business, customer, and entries)
    await prisma.user.deleteMany({
      where: { id: testUserId },
    });
    await prisma.$disconnect();
  }, 30000);

  it("automatically advances server_updated_at via PostgreSQL trigger on UPDATE and preserves Decimal(14,2)", async () => {
    const nowMs = BigInt(Date.now());

    // 1. Create User
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `cp20_${testUserId}@example.com`,
        name: "CP20 Trigger Tester",
      },
    });

    // 2. Create Business
    const createdBiz = await prisma.business.create({
      data: {
        id: testBusinessId,
        ownerUserId: testUserId,
        name: "Trigger Test Store",
        currency: "BDT",
        createdAt: nowMs,
        updatedAt: nowMs,
      },
    });

    const firstServerTime = createdBiz.serverUpdatedAt.getTime();
    expect(firstServerTime).toBeGreaterThan(0);

    // Wait 30ms so clock_timestamp() is guaranteed to advance
    await new Promise((resolve) => setTimeout(resolve, 30));

    // 3. Update Business via Raw SQL (bypassing Prisma client hooks to prove DB trigger works)
    await prisma.$executeRaw`
      UPDATE businesses
      SET name = 'Updated Store Name', updated_at = ${nowMs + 100n}
      WHERE id = ${testBusinessId}::uuid
    `;

    const updatedBiz = await prisma.business.findUniqueOrThrow({
      where: { id: testBusinessId },
    });

    expect(updatedBiz.name).toBe("Updated Store Name");
    expect(updatedBiz.serverUpdatedAt.getTime()).toBeGreaterThan(
      firstServerTime,
    );

    // 4. Create Customer & CustomerEntry to verify NUMERIC(14,2) precision
    await prisma.customer.create({
      data: {
        id: testCustomerId,
        businessId: testBusinessId,
        name: "Test Customer",
        avatarInitials: "TC",
        createdAt: nowMs,
        updatedAt: nowMs,
      },
    });

    const entry = await prisma.customerEntry.create({
      data: {
        id: testEntryId,
        businessId: testBusinessId,
        customerId: testCustomerId,
        type: "GOT",
        amount: "1250.50",
        details: "Decimal check",
        entryDate: "2026-10-30",
        entryTime: "10:30 AM",
        timestamp: nowMs,
        createdAt: nowMs,
        updatedAt: nowMs,
      },
    });

    expect(entry.amount.toFixed(2)).toBe("1250.50");
  }, 30000);
});
