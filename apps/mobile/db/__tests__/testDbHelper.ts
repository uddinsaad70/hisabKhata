// apps/mobile/db/__tests__/testDbHelper.ts
import Database from "better-sqlite3";
import type { DatabaseAdapter, RunResult, SqlBindParam } from "../adapter";

export interface TestDatabaseContext {
  adapter: DatabaseAdapter;
  rawDb: Database.Database;
  close: () => void;
}

/**
 * Creates an isolated in-memory SQLite database backed by better-sqlite3
 * that implements the exact DatabaseAdapter interface used by mobile queries.
 */
export function createInMemoryDatabase(): TestDatabaseContext {
  const rawDb = new Database(":memory:");
  rawDb.pragma("foreign_keys = ON");

  let transactionDepth = 0;

  const adapter: DatabaseAdapter = {
    async getAllAsync<T>(
      sql: string,
      params: SqlBindParam[] = [],
    ): Promise<T[]> {
      const stmt = rawDb.prepare(sql);
      return stmt.all(...params) as T[];
    },

    async getFirstAsync<T>(
      sql: string,
      params: SqlBindParam[] = [],
    ): Promise<T | null> {
      const stmt = rawDb.prepare(sql);
      const row = stmt.get(...params) as T | undefined;
      return row ?? null;
    },

    async runAsync(
      sql: string,
      params: SqlBindParam[] = [],
    ): Promise<RunResult> {
      const stmt = rawDb.prepare(sql);
      const info = stmt.run(...params);
      return {
        changes: info.changes,
        lastInsertRowId: Number(info.lastInsertRowid),
      };
    },

    async execAsync(sql: string): Promise<void> {
      rawDb.exec(sql);
    },

    async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
      const isTopLevel = transactionDepth === 0;
      const savepointName = `sp_${transactionDepth}`;
      transactionDepth += 1;

      rawDb.exec(
        isTopLevel
          ? "BEGIN IMMEDIATE TRANSACTION;"
          : `SAVEPOINT ${savepointName};`,
      );

      try {
        const result = await task();
        rawDb.exec(
          isTopLevel ? "COMMIT;" : `RELEASE SAVEPOINT ${savepointName};`,
        );
        return result;
      } catch (error) {
        rawDb.exec(
          isTopLevel
            ? "ROLLBACK;"
            : `ROLLBACK TO SAVEPOINT ${savepointName}; RELEASE SAVEPOINT ${savepointName};`,
        );
        throw error;
      } finally {
        transactionDepth -= 1;
      }
    },
  };

  return {
    adapter,
    rawDb,
    close: () => {
      rawDb.close();
    },
  };
}

/**
 * Helper used by query test suites (e.g. businessQueries.test.ts).
 * Returns TestDatabaseContext containing { adapter, rawDb, close }.
 */
export function createInMemoryDatabaseAdapter(): TestDatabaseContext {
  return createInMemoryDatabase();
}
