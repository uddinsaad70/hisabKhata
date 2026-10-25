import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
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
    // On web preview without WASM headers, provide a safe simulated readiness summary
    // while real Android/iOS devices run the native C++ SQLite engine.
    if (Platform.OS === "web") {
      latestHealth = {
        userVersion: LATEST_SCHEMA_VERSION,
        tableCount: CORE_TABLE_NAMES.length,
        indexCount: CORE_INDEX_NAMES.length,
        foreignKeysEnabled: true,
        isReady: true,
      };
      return latestHealth;
    }

    const rawDb = await SQLite.openDatabaseAsync(DATABASE_FILE_NAME);
    adapterInstance = createExpoSqliteAdapter(rawDb);
    await runMigrations(adapterInstance);
    latestHealth = await getDatabaseHealth(adapterInstance);
    return latestHealth;
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
    throw new Error("DatabaseAdapter is not available on this platform.");
  }
  return adapterInstance;
}
