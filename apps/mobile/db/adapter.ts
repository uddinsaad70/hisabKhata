// apps/mobile/db/adapter.ts
import type { SQLiteDatabase } from "expo-sqlite";

/**
 * Allowed primitive parameter types for parameterized SQL queries.
 */
export type SqlBindParam = string | number | null;

/**
 * Standardized result returned by INSERT, UPDATE, or DELETE statements.
 */
export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

/**
 * Database driver abstraction shared between production (expo-sqlite on device)
 * and automated tests (better-sqlite3 in-memory in Node/Jest).
 */
export interface DatabaseAdapter {
  /**
   * Executes a SELECT query and returns all matching rows.
   */
  getAllAsync<T>(sql: string, params?: SqlBindParam[]): Promise<T[]>;

  /**
   * Executes a SELECT query and returns the first matching row or null.
   */
  getFirstAsync<T>(sql: string, params?: SqlBindParam[]): Promise<T | null>;

  /**
   * Executes a mutating parameterized SQL statement (INSERT, UPDATE, DELETE).
   */
  runAsync(sql: string, params?: SqlBindParam[]): Promise<RunResult>;

  /**
   * Executes one or more raw SQL statements (DDL migrations, PRAGMAs).
   */
  execAsync(sql: string): Promise<void>;

  /**
   * Runs the provided async callback inside an atomic SQLite transaction.
   * Commits on resolution and rolls back automatically if an error is thrown.
   */
  withTransactionAsync<T>(task: () => Promise<T>): Promise<T>;
}

/**
 * Wraps an Expo SQLiteDatabase instance into the standard DatabaseAdapter interface.
 */
export function createExpoSqliteAdapter(db: SQLiteDatabase): DatabaseAdapter {
  let transactionDepth = 0;

  return {
    async getAllAsync<T>(
      sql: string,
      params: SqlBindParam[] = [],
    ): Promise<T[]> {
      return db.getAllAsync<T>(sql, params);
    },

    async getFirstAsync<T>(
      sql: string,
      params: SqlBindParam[] = [],
    ): Promise<T | null> {
      const row = await db.getFirstAsync<T>(sql, params);
      return row ?? null;
    },

    async runAsync(
      sql: string,
      params: SqlBindParam[] = [],
    ): Promise<RunResult> {
      const result = await db.runAsync(sql, params);
      return {
        changes: result.changes,
        lastInsertRowId: Number(result.lastInsertRowId),
      };
    },

    async execAsync(sql: string): Promise<void> {
      await db.execAsync(sql);
    },

    async withTransactionAsync<T>(task: () => Promise<T>): Promise<T> {
      const isTopLevel = transactionDepth === 0;
      const savepointName = `sp_${transactionDepth}`;
      transactionDepth += 1;

      await db.execAsync(
        isTopLevel
          ? "BEGIN IMMEDIATE TRANSACTION;"
          : `SAVEPOINT ${savepointName};`,
      );

      try {
        const result = await task();
        await db.execAsync(
          isTopLevel ? "COMMIT;" : `RELEASE SAVEPOINT ${savepointName};`,
        );
        return result;
      } catch (error) {
        await db.execAsync(
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
}
