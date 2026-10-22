// apps/mobile/db/__tests__/adapter.test.ts
import {
  createInMemoryDatabase,
  type TestDatabaseContext,
} from "./testDbHelper";

describe("DatabaseAdapter & better-sqlite3 In-Memory Test Harness (CP02b)", () => {
  let ctx: TestDatabaseContext;

  beforeEach(async () => {
    ctx = createInMemoryDatabase();
    await ctx.adapter.execAsync(`
      CREATE TABLE ledger_items (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('GAVE', 'GOT')),
        amount REAL NOT NULL CHECK (amount > 0),
        entry_date TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
    `);
  });

  afterEach(() => {
    ctx.close();
  });

  it("supports parameterized runAsync, getFirstAsync, and getAllAsync", async () => {
    const insertResult = await ctx.adapter.runAsync(
      `INSERT INTO ledger_items (id, type, amount, entry_date, timestamp) VALUES (?, ?, ?, ?, ?);`,
      ["0192a-1", "GAVE", 1000.5, "2026-10-10", 1700000001000],
    );
    expect(insertResult.changes).toBe(1);

    const single = await ctx.adapter.getFirstAsync<{
      id: string;
      type: string;
      amount: number;
    }>(`SELECT id, type, amount FROM ledger_items WHERE id = ?;`, ["0192a-1"]);

    expect(single).toEqual({
      id: "0192a-1",
      type: "GAVE",
      amount: 1000.5,
    });

    const missing = await ctx.adapter.getFirstAsync(
      `SELECT id FROM ledger_items WHERE id = ?;`,
      ["non-existent"],
    );
    expect(missing).toBeNull();

    const allRows = await ctx.adapter.getAllAsync<{ id: string }>(
      `SELECT id FROM ledger_items;`,
    );
    expect(allRows).toHaveLength(1);
  });

  it("executes SQLite Window Functions (SUM OVER) accurately for backdated entries", async () => {
    await ctx.adapter.runAsync(
      `INSERT INTO ledger_items (id, type, amount, entry_date, timestamp) VALUES (?, ?, ?, ?, ?);`,
      ["entry-1", "GAVE", 1000, "2026-10-10", 100],
    );
    await ctx.adapter.runAsync(
      `INSERT INTO ledger_items (id, type, amount, entry_date, timestamp) VALUES (?, ?, ?, ?, ?);`,
      ["entry-3", "GOT", 400, "2026-10-15", 300],
    );
    // Insert a backdated entry on Oct 12
    await ctx.adapter.runAsync(
      `INSERT INTO ledger_items (id, type, amount, entry_date, timestamp) VALUES (?, ?, ?, ?, ?);`,
      ["entry-2", "GOT", 300, "2026-10-12", 200],
    );

    const rows = await ctx.adapter.getAllAsync<{
      id: string;
      entry_date: string;
      running_balance: number;
    }>(`
      SELECT
        id,
        entry_date,
        ROUND(
          SUM(CASE WHEN type = 'GOT' THEN amount ELSE -amount END)
          OVER (
            ORDER BY entry_date ASC, timestamp ASC, id ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
          ),
          2
        ) AS running_balance
      FROM ledger_items
      ORDER BY entry_date ASC, timestamp ASC, id ASC;
    `);

    expect(rows).toEqual([
      { id: "entry-1", entry_date: "2026-10-10", running_balance: -1000 },
      { id: "entry-2", entry_date: "2026-10-12", running_balance: -700 },
      { id: "entry-3", entry_date: "2026-10-15", running_balance: -300 },
    ]);
  });

  it("commits changes when withTransactionAsync succeeds and rolls back on error", async () => {
    // 1. Successful transaction
    await ctx.adapter.withTransactionAsync(async () => {
      await ctx.adapter.runAsync(
        `INSERT INTO ledger_items (id, type, amount, entry_date, timestamp) VALUES (?, ?, ?, ?, ?);`,
        ["tx-ok-1", "GOT", 500, "2026-10-18", 1000],
      );
      await ctx.adapter.runAsync(
        `INSERT INTO ledger_items (id, type, amount, entry_date, timestamp) VALUES (?, ?, ?, ?, ?);`,
        ["tx-ok-2", "GAVE", 200, "2026-10-18", 1001],
      );
    });

    const afterCommit = await ctx.adapter.getAllAsync<{ id: string }>(
      `SELECT id FROM ledger_items;`,
    );
    expect(afterCommit).toHaveLength(2);

    // 2. Failing transaction must roll back completely
    await expect(
      ctx.adapter.withTransactionAsync(async () => {
        await ctx.adapter.runAsync(
          `INSERT INTO ledger_items (id, type, amount, entry_date, timestamp) VALUES (?, ?, ?, ?, ?);`,
          ["tx-fail-1", "GOT", 900, "2026-10-19", 2000],
        );
        throw new Error("Simulated mid-transaction failure");
      }),
    ).rejects.toThrow("Simulated mid-transaction failure");

    const afterRollback = await ctx.adapter.getAllAsync<{ id: string }>(
      `SELECT id FROM ledger_items;`,
    );
    expect(afterRollback).toHaveLength(2);
  });
});
