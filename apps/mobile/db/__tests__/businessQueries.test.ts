// apps/mobile/db/__tests__/businessQueries.test.ts
import { createInMemoryDatabaseAdapter } from "./testDbHelper";
import { runMigrations } from "../migrations";
import {
  createBusiness,
  getAllBusinesses,
  getBusinessById,
  getOrInitDeviceSyncState,
  updateBusiness,
} from "../businessQueries";
import { generateId } from "../../utils/uuid";

describe("businessQueries on real in-memory SQLite", () => {
  it("creates businesses, defaults currency to BDT, and sets is_synced = 0", async () => {
    const { adapter, close } = createInMemoryDatabaseAdapter();
    try {
      await runMigrations(adapter);

      const biz1 = await createBusiness(adapter, { name: "  Amar Dokan  " });
      expect(biz1.id).toMatch(/^01[9a]/);
      expect(biz1.name).toBe("Amar Dokan");
      expect(biz1.currency).toBe("BDT");
      expect(biz1.is_synced).toBe(0);
      expect(biz1.is_deleted).toBe(0);

      const biz2 = await createBusiness(adapter, {
        name: "Kolkata Branch",
        currency: "INR",
      });

      expect(biz2.currency).toBe("INR");

      const all = await getAllBusinesses(adapter);
      expect(all).toHaveLength(2);
      expect(all[0].name).toBe("Amar Dokan");
      expect(all[0].customer_count).toBe(0);
      expect(all[1].name).toBe("Kolkata Branch");
      expect(all[1].currency).toBe("INR");
    } finally {
      close();
    }
  });

  it("counts only active (is_deleted = 0) customers per business", async () => {
    const { adapter, close } = createInMemoryDatabaseAdapter();
    try {
      await runMigrations(adapter);
      const biz = await createBusiness(adapter, { name: "Main Store" });
      const now = Date.now();

      // Insert 2 active customers and 1 soft-deleted customer
      await adapter.runAsync(
        `INSERT INTO customers (id, business_id, name, avatar_initials, created_at, updated_at, is_deleted, is_synced)
         VALUES (?, ?, 'Rahim', 'R', ?, ?, 0, 0),
                (?, ?, 'Karim', 'K', ?, ?, 0, 0),
                (?, ?, 'Deleted User', 'DU', ?, ?, 1, 0);`,
        [
          generateId(),
          biz.id,
          now,
          now,
          generateId(),
          biz.id,
          now,
          now,
          generateId(),
          biz.id,
          now,
          now,
        ],
      );

      const list = await getAllBusinesses(adapter);
      expect(list).toHaveLength(1);
      expect(list[0].customer_count).toBe(2);
    } finally {
      close();
    }
  });

  it("updates business name and currency and resets is_synced to 0", async () => {
    const { adapter, close } = createInMemoryDatabaseAdapter();
    try {
      await runMigrations(adapter);
      const biz = await createBusiness(adapter, { name: "Old Name" });

      // Simulate synced state
      await adapter.runAsync(
        `UPDATE businesses SET is_synced = 1 WHERE id = ?;`,
        [biz.id],
      );

      const updated = await updateBusiness(adapter, {
        id: biz.id,
        name: "New Store Name",
        currency: "INR",
      });

      expect(updated.name).toBe("New Store Name");
      expect(updated.currency).toBe("INR");
      expect(updated.is_synced).toBe(0);
      expect(updated.updated_at).toBeGreaterThanOrEqual(biz.updated_at);

      const fromDb = await getBusinessById(adapter, biz.id);
      expect(fromDb?.name).toBe("New Store Name");
      expect(fromDb?.currency).toBe("INR");
      expect(fromDb?.is_synced).toBe(0);
    } finally {
      close();
    }
  });

  it("rejects empty names and invalid currency codes", async () => {
    const { adapter, close } = createInMemoryDatabaseAdapter();
    try {
      await runMigrations(adapter);

      await expect(createBusiness(adapter, { name: "   " })).rejects.toThrow(
        "BUSINESS_NAME_REQUIRED",
      );

      await expect(
        // @ts-expect-error testing invalid runtime currency
        createBusiness(adapter, { name: "Valid Name", currency: "USD" }),
      ).rejects.toThrow("INVALID_CURRENCY");
    } finally {
      close();
    }
  });

  it("initializes and persists a single GLOBAL device_id in sync_state", async () => {
    const { adapter, close } = createInMemoryDatabaseAdapter();
    try {
      await runMigrations(adapter);

      const first = await getOrInitDeviceSyncState(adapter);
      expect(first.business_id).toBe("GLOBAL");
      expect(first.device_id).toMatch(/^01[9a]/);
      const second = await getOrInitDeviceSyncState(adapter);
      expect(second.device_id).toBe(first.device_id);
    } finally {
      close();
    }
  });
});
