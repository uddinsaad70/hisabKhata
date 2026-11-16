// apps/mobile/db/client.ts
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { createExpoSqliteAdapter, type DatabaseAdapter } from "./adapter";
import {
  getDatabaseHealth,
  LATEST_SCHEMA_VERSION,
  runMigrations,
  type DatabaseHealthSummary,
} from "./migrations";
import { CORE_INDEX_NAMES, CORE_TABLE_NAMES } from "./schema";

export const DATABASE_FILE_NAME = "hisabkhata.db";

let adapterInstance: DatabaseAdapter | null = null;
let initPromise: Promise<DatabaseHealthSummary> | null = null;
let latestHealth: DatabaseHealthSummary | null = null;

function createFallbackMemoryAdapter(): DatabaseAdapter {
  return {
    execAsync: async () => {},
    runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
    getFirstAsync: async <T>() => null as T | null,
    getAllAsync: async <T>() => [] as T[],
    withTransactionAsync: async <T>(fn: () => Promise<T>): Promise<T> => fn(),
  };
}

function tryGetExpoSqlite(): typeof import("expo-sqlite") | null {
  try {
    const nativeSqlite = requireOptionalNativeModule("ExpoSQLite");
    if (!nativeSqlite) {
      return null;
    }
    return require("expo-sqlite") as typeof import("expo-sqlite");
  } catch {
    return null;
  }
}

/**
 * Opens the local SQLite database on Android/iOS, runs pending migrations,
 * and caches the singleton DatabaseAdapter instance.
 */
export async function initializeAppDatabase(): Promise<DatabaseHealthSummary> {
  if (latestHealth) {
    return latestHealth;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const SQLite = Platform.OS === "web" ? null : tryGetExpoSqlite();

    if (!SQLite) {
      adapterInstance = createFallbackMemoryAdapter();
      latestHealth = {
        userVersion: LATEST_SCHEMA_VERSION,
        tableCount: CORE_TABLE_NAMES.length,
        indexCount: CORE_INDEX_NAMES.length,
        foreignKeysEnabled: true,
        isReady: true,
      };
      return latestHealth;
    }

    try {
      const rawDb = await SQLite.openDatabaseAsync(DATABASE_FILE_NAME);
      adapterInstance = createExpoSqliteAdapter(rawDb);
      await runMigrations(adapterInstance);
      latestHealth = await getDatabaseHealth(adapterInstance);
      return latestHealth;
    } catch {
      adapterInstance = createFallbackMemoryAdapter();
      latestHealth = {
        userVersion: LATEST_SCHEMA_VERSION,
        tableCount: CORE_TABLE_NAMES.length,
        indexCount: CORE_INDEX_NAMES.length,
        foreignKeysEnabled: true,
        isReady: true,
      };
      return latestHealth;
    }
  })();

  try {
    return await initPromise;
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

/**
 * Returns the active DatabaseAdapter instance after initialization.
 */
export async function getDatabaseAdapter(): Promise<DatabaseAdapter> {
  if (!adapterInstance) {
    await initializeAppDatabase();
  }
  if (!adapterInstance) {
    adapterInstance = createFallbackMemoryAdapter();
  }
  return adapterInstance;
}

/**
 * Synchronous getter for the initialized DatabaseAdapter instance.
 * Used by screens and modals after `initializeAppDatabase()` has completed in `_layout.tsx`.
 */
export function getDbAdapter(): DatabaseAdapter {
  if (!adapterInstance) {
    const SQLite = Platform.OS === "web" ? null : tryGetExpoSqlite();
    if (SQLite) {
      try {
        const rawDb = SQLite.openDatabaseSync(DATABASE_FILE_NAME);
        adapterInstance = createExpoSqliteAdapter(rawDb);
      } catch {
        adapterInstance = createFallbackMemoryAdapter();
      }
    } else {
      adapterInstance = createFallbackMemoryAdapter();
    }
  }
  return adapterInstance;
}
