// apps/mobile/__tests__/userAuth.test.ts
import { type DatabaseAdapter } from "../db/adapter";
import { claimLocalBusinessesForUser } from "../db/businessQueries";

describe("CP26: First-Login Local Business Ownership Claim", () => {
  it("updates owner_user_id and marks is_synced = 0 for all unowned local businesses upon login", async () => {
    const executedQueries: { sql: string; params: unknown[] }[] = [];

    const mockDb: DatabaseAdapter = {
      execAsync: async () => {},
      runAsync: async (sql: string, params: unknown[] = []) => {
        executedQueries.push({ sql, params });
        return { changes: 2, lastInsertRowId: 0 };
      },
      getFirstAsync: async () => null,
      getAllAsync: async () => [],
      withTransactionAsync: async <T>(task: () => Promise<T>): Promise<T> => {
        return await task();
      },
    };

    const serverUserId = "0192a8b0-7c12-7000-8000-000000000099";
    const claimedCount = await claimLocalBusinessesForUser(
      mockDb,
      serverUserId,
    );

    expect(claimedCount).toBe(2);
    expect(executedQueries).toHaveLength(1);
    expect(executedQueries[0].sql).toContain("SET owner_user_id = ?");
    expect(executedQueries[0].sql).toContain("is_synced = 0");
    expect(executedQueries[0].sql).toContain("WHERE owner_user_id IS NULL");
    expect(executedQueries[0].params[0]).toBe(serverUserId);
  });
});
