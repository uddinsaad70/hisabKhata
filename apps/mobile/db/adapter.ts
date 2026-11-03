// apps/mobile/db/adapter.ts
import type { SQLiteDatabase } from "expo-sqlite";
import { DeviceEventEmitter } from "react-native";

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
  getAllAsync<T>(sql: string, params?: SqlBindParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlBindParam[]): Promise<T | null>;
  runAsync(sql: string, params?: SqlBindParam[]): Promise<RunResult>;
  execAsync(sql: string): Promise<void>;
  withTransactionAsync<T>(task: () => Promise<T>): Promise<T>;
}

/**
 * Wraps an Expo SQLiteDatabase instance into the standard DatabaseAdapter interface.
 * Automatically emits "LOCAL_DATA_MUTATED" whenever unsynced business/customer/entry data is written.
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

      // Whenever a local mutation marks a record unsynced (is_synced = 0), notify the 2-second auto-sync watcher
      if (
        result.changes > 0 &&
        /INSERT INTO|UPDATE/i.test(sql) &&
        !sql.includes("sync_state") &&
        !sql.includes("SET is_synced = 1") &&
        !sql.includes("SET net_balance =")
      ) {
        DeviceEventEmitter.emit("LOCAL_DATA_MUTATED");
      }

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
