// apps/mobile/__tests__/syncService.test.ts
import { type DatabaseAdapter } from "../db/adapter";
import {
  CursorExpiredError,
  runFullSyncCycle,
  type SyncTransport,
  type SyncPushRequest,
  type SyncPushResponse,
} from "../db/syncService";

function createMockSyncDb() {
  const executedSql: string[] = [];
  let unsyncedReturned = false;

  const db: DatabaseAdapter = {
    execAsync: async () => {},
    runAsync: async (sql: string) => {
      executedSql.push(sql.trim());
      return { changes: 1, lastInsertRowId: 1 };
    },
    getFirstAsync: async <T>(sql: string): Promise<T | null> => {
      if (sql.includes("FROM sync_state")) {
        return {
          business_id: "GLOBAL",
          device_id: "0192a8b0-0000-7000-8000-000000000001",
          last_pulled_cursor: "old_cursor_token",
          last_pushed_at: 0,
        } as unknown as T;
      }
      return null;
    },
    getAllAsync: async <T>(sql: string): Promise<T[]> => {
      if (sql.includes("FROM businesses WHERE is_synced = 0")) {
        if (!unsyncedReturned) {
          unsyncedReturned = true;
          return [
            {
              id: "0192a8b1-1111-7000-8000-000000000001",
              owner_user_id: "user-1",
              name: "Amar Dokan",
              currency: "BDT",
              created_at: 1000,
              updated_at: 1000,
              is_deleted: 0,
              is_synced: 0,
            },
          ] as unknown as T[];
        }
      }
      return [];
    },
    withTransactionAsync: async <T>(task: () => Promise<T>): Promise<T> => {
      return await task();
    },
  };

  return { db, executedSql };
}

describe("CP27: Mobile Sync Engine (runFullSyncCycle & 410 Gone Resync)", () => {
  it("pushes unsynced batches, resolves rejectedConflicts, and pulls paginated changes", async () => {
    const { db, executedSql } = createMockSyncDb();

    const mockTransport: SyncTransport = {
      push: async (req: SyncPushRequest): Promise<SyncPushResponse> => {
        expect(req.changes.businesses).toHaveLength(1);
        return {
          accepted: {
            businesses: [req.changes.businesses[0].id],
            customers: [],
            customerEntries: [],
            cashbookEntries: [],
          },
          rejectedConflicts: {
            businesses: [],
            customers: [
              {
                id: "0192a8b2-2222-7000-8000-000000000002",
                businessId: req.changes.businesses[0].id,
                name: "Server Winner Customer",
                phone: "01700000000",
                avatarInitials: "SW",
                createdAt: 1000,
                updatedAt: 5000,
                isDeleted: false,
              },
            ],
            customerEntries: [],
            cashbookEntries: [],
          },
          serverTime: new Date().toISOString(),
        };
      },
      pull: async (_deviceId, cursor) => {
        if (cursor === "old_cursor_token") {
          return {
            changes: {
              businesses: [],
              customers: [],
              customerEntries: [
                {
                  id: "0192a8b3-3333-7000-8000-000000000003",
                  businessId: "0192a8b1-1111-7000-8000-000000000001",
                  customerId: "0192a8b2-2222-7000-8000-000000000002",
                  type: "GOT",
                  amount: "500.00",
                  details: "Pulled entry",
                  entryDate: "2026-11-03",
                  entryTime: "10:00 AM",
                  timestamp: 2000,
                  createdAt: 2000,
                  updatedAt: 2000,
                  isDeleted: false,
                },
              ],
              cashbookEntries: [],
            },
            nextCursor: "new_cursor_page_2",
            hasMore: false,
          };
        }
        return {
          changes: {
            businesses: [],
            customers: [],
            customerEntries: [],
            cashbookEntries: [],
          },
          nextCursor: cursor,
          hasMore: false,
        };
      },
    };

    const summary = await runFullSyncCycle(db, mockTransport, "user-1");

    expect(summary.pushedCount).toBe(1);
    expect(summary.conflictsResolved).toBe(1);
    expect(summary.pulledCount).toBe(1);
    expect(summary.resyncedFromScratch).toBe(false);
    // Verify recomputeBalance was triggered for the affected customer
    expect(
      executedSql.some((s) => s.includes("SET net_balance = COALESCE")),
    ).toBe(true);
  });

  it("handles 410 Gone CursorExpiredError by wiping synced cache and pulling from null cursor", async () => {
    const { db, executedSql } = createMockSyncDb();
    let pullAttempts = 0;

    const mockTransport: SyncTransport = {
      push: async (req) => ({
        accepted: {
          businesses: req.changes.businesses.map((b) => b.id),
          customers: [],
          customerEntries: [],
          cashbookEntries: [],
        },
        rejectedConflicts: {
          businesses: [],
          customers: [],
          customerEntries: [],
          cashbookEntries: [],
        },
        serverTime: new Date().toISOString(),
      }),
      pull: async (_deviceId, cursor) => {
        pullAttempts += 1;
        if (pullAttempts === 1 && cursor === "old_cursor_token") {
          throw new CursorExpiredError();
        }
        expect(cursor).toBeNull();
        return {
          changes: {
            businesses: [],
            customers: [],
            customerEntries: [],
            cashbookEntries: [],
          },
          nextCursor: "fresh_cursor_token",
          hasMore: false,
        };
      },
    };

    const summary = await runFullSyncCycle(db, mockTransport, "user-1");

    expect(summary.resyncedFromScratch).toBe(true);
    expect(pullAttempts).toBe(2);
    expect(
      executedSql.some((s) =>
        s.includes("DELETE FROM customer_entries WHERE is_synced = 1"),
      ),
    ).toBe(true);
  });
});
