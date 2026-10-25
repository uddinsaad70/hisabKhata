import {
  BackupVersionTooNewError,
  getDatabaseHealth,
  LATEST_SCHEMA_VERSION,
  runMigrations,
} from "../migrations";
import { CORE_INDEX_NAMES, CORE_TABLE_NAMES } from "../schema";
import {
  createInMemoryDatabase,
  type TestDatabaseContext,
} from "./testDbHelper";

describe("SQLite V1 Schema and PRAGMA user_version Migration Runner (CP03)", () => {
  let ctx: TestDatabaseContext;

  beforeEach(() => {
    ctx = createInMemoryDatabase();
  });

  afterEach(() => {
    ctx.close();
  });

  it("migrates a fresh database from v0 to v1 and creates all 5 tables and 7 indexes", async () => {
    const beforeRow = await ctx.adapter.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version;",
    );
    expect(beforeRow?.user_version).toBe(0);

    const appliedVersion = await runMigrations(ctx.adapter);
    expect(appliedVersion).toBe(LATEST_SCHEMA_VERSION);

    const health = await getDatabaseHealth(ctx.adapter);
    expect(health).toEqual({
      userVersion: 1,
      tableCount: CORE_TABLE_NAMES.length,
      indexCount: CORE_INDEX_NAMES.length,
      foreignKeysEnabled: true,
      isReady: true,
    });
  });

  it("is idempotent when runMigrations is called multiple times", async () => {
    await runMigrations(ctx.adapter);

    await ctx.adapter.runAsync(
      `INSERT INTO businesses (id, name, currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?);`,
      ["biz-1", "My Shop", "BDT", 1700000000000, 1700000000000],
    );

    const secondVersion = await runMigrations(ctx.adapter);
    expect(secondVersion).toBe(1);

    const biz = await ctx.adapter.getFirstAsync<{ id: string; name: string }>(
      "SELECT id, name FROM businesses WHERE id = ?;",
      ["biz-1"],
    );
    expect(biz).toEqual({ id: "biz-1", name: "My Shop" });
  });

  it("enforces CHECK constraints on currency, entry type, payment_mode, and positive amount", async () => {
    await runMigrations(ctx.adapter);

    // 1. Invalid currency code (only BDT and INR are allowed)
    await expect(
      ctx.adapter.runAsync(
        `INSERT INTO businesses (id, name, currency, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?);`,
        [
          "biz-bad",
          "Invalid Currency Shop",
          "USD",
          1700000000000,
          1700000000000,
        ],
      ),
    ).rejects.toThrow(/CHECK constraint failed/i);

    // Insert valid business and customer
    await ctx.adapter.runAsync(
      `INSERT INTO businesses (id, name, currency, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?);`,
      ["biz-1", "Valid Shop", "BDT", 1700000000000, 1700000000000],
    );
    await ctx.adapter.runAsync(
      `INSERT INTO customers (id, business_id, name, avatar_initials, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?);`,
      ["cust-1", "biz-1", "Younus Mg", "YM", 1700000000000, 1700000000000],
    );

    // 2. Zero or negative amount must fail CHECK (amount > 0)
    await expect(
      ctx.adapter.runAsync(
        `INSERT INTO customer_entries (
           id, business_id, customer_id, type, amount, entry_date, entry_time, timestamp, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          "entry-zero",
          "biz-1",
          "cust-1",
          "GAVE",
          0,
          "2026-10-21",
          "12:00 PM",
          1700000000000,
          1700000000000,
          1700000000000,
        ],
      ),
    ).rejects.toThrow(/CHECK constraint failed/i);

    // 3. Invalid cashbook payment_mode must fail CHECK (payment_mode IN ('CASH', 'ONLINE'))
    await expect(
      ctx.adapter.runAsync(
        `INSERT INTO cashbook_entries (
           id, business_id, type, payment_mode, amount, entry_date, entry_time, timestamp, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          "cb-bad",
          "biz-1",
          "IN",
          "CARD",
          500,
          "2026-10-21",
          "12:00 PM",
          1700000000000,
          1700000000000,
          1700000000000,
        ],
      ),
    ).rejects.toThrow(/CHECK constraint failed/i);
  });

  it("supports GLOBAL sync_state row and enforces foreign key references", async () => {
    await runMigrations(ctx.adapter);

    await ctx.adapter.runAsync(
      `INSERT INTO sync_state (business_id, device_id, last_pulled_cursor, last_pushed_at)
       VALUES (?, ?, ?, ?);`,
      ["GLOBAL", "device-uuid-v7", null, 0],
    );

    const syncRow = await ctx.adapter.getFirstAsync<{
      business_id: string;
      device_id: string;
    }>("SELECT business_id, device_id FROM sync_state WHERE business_id = ?;", [
      "GLOBAL",
    ]);
    expect(syncRow).toEqual({
      business_id: "GLOBAL",
      device_id: "device-uuid-v7",
    });

    // Inserting a customer for a non-existent business_id must fail foreign key check
    await expect(
      ctx.adapter.runAsync(
        `INSERT INTO customers (id, business_id, name, avatar_initials, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          "cust-orphan",
          "non-existent-biz",
          "Orphan",
          "OR",
          1700000000000,
          1700000000000,
        ],
      ),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/i);
  });

  it("throws BackupVersionTooNewError (BACKUP_VERSION_TOO_NEW) when user_version > LATEST_SCHEMA_VERSION", async () => {
    await ctx.adapter.execAsync("PRAGMA user_version = 99;");

    await expect(runMigrations(ctx.adapter)).rejects.toThrow(
      BackupVersionTooNewError,
    );
    await expect(runMigrations(ctx.adapter)).rejects.toThrow(
      /BACKUP_VERSION_TOO_NEW/,
    );
  });
});
