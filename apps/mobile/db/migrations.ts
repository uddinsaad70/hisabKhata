import { type DatabaseAdapter } from "./adapter";
import {
  CORE_INDEX_NAMES,
  CORE_TABLE_NAMES,
  INITIAL_PRAGMAS_SQL,
  INITIAL_V1_SCHEMA_SQL,
} from "./schema";

export const LATEST_SCHEMA_VERSION = 1;
export const BACKUP_VERSION_TOO_NEW_CODE = "BACKUP_VERSION_TOO_NEW";

export class BackupVersionTooNewError extends Error {
  public readonly code = BACKUP_VERSION_TOO_NEW_CODE;
  public readonly dbVersion: number;
  public readonly appSupportedVersion: number;

  constructor(
    dbVersion: number,
    appSupportedVersion: number = LATEST_SCHEMA_VERSION,
  ) {
    super(
      `${BACKUP_VERSION_TOO_NEW_CODE}: Database file version (v${dbVersion}) is newer than the current app version (v${appSupportedVersion}). Please update the app first.`,
    );
    this.name = "BackupVersionTooNewError";
    this.dbVersion = dbVersion;
    this.appSupportedVersion = appSupportedVersion;
  }
}

export interface DatabaseHealthSummary {
  userVersion: number;
  tableCount: number;
  indexCount: number;
  foreignKeysEnabled: boolean;
  isReady: boolean;
}

const MIGRATIONS: Record<number, (db: DatabaseAdapter) => Promise<void>> = {
  1: async (db: DatabaseAdapter) => {
    await db.execAsync(INITIAL_V1_SCHEMA_SQL);
  },
};

/**
 * Runs sequential SQLite migrations using PRAGMA user_version.
 * Always enables foreign_keys and WAL journal mode first.
 */
export async function runMigrations(db: DatabaseAdapter): Promise<number> {
  await db.execAsync(INITIAL_PRAGMAS_SQL);

  const row = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version;",
  );
  let currentVersion = row?.user_version ?? 0;

  if (currentVersion > LATEST_SCHEMA_VERSION) {
    throw new BackupVersionTooNewError(currentVersion, LATEST_SCHEMA_VERSION);
  }

  while (currentVersion < LATEST_SCHEMA_VERSION) {
    const nextVersion = currentVersion + 1;
    const migrateFn = MIGRATIONS[nextVersion];

    if (!migrateFn) {
      throw new Error(
        `Missing migration handler for schema version ${nextVersion}`,
      );
    }

    await db.withTransactionAsync(async () => {
      await migrateFn(db);
      await db.execAsync(`PRAGMA user_version = ${nextVersion};`);
    });

    currentVersion = nextVersion;
  }

  return currentVersion;
}

/**
 * Returns a live diagnostic summary of the local SQLite database.
 * Used by tests and the UI status indicator to confirm tables and indexes exist.
 */
export async function getDatabaseHealth(
  db: DatabaseAdapter,
): Promise<DatabaseHealthSummary> {
  const versionRow = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version;",
  );
  const fkRow = await db.getFirstAsync<{ foreign_keys: number }>(
    "PRAGMA foreign_keys;",
  );

  const tablePlaceholders = CORE_TABLE_NAMES.map(() => "?").join(", ");
  const tableRows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${tablePlaceholders});`,
    [...CORE_TABLE_NAMES],
  );

  const indexPlaceholders = CORE_INDEX_NAMES.map(() => "?").join(", ");
  const indexRows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'index' AND name IN (${indexPlaceholders});`,
    [...CORE_INDEX_NAMES],
  );

  const userVersion = versionRow?.user_version ?? 0;
  const tableCount = tableRows.length;
  const indexCount = indexRows.length;
  const foreignKeysEnabled = fkRow?.foreign_keys === 1;

  return {
    userVersion,
    tableCount,
    indexCount,
    foreignKeysEnabled,
    isReady:
      userVersion === LATEST_SCHEMA_VERSION &&
      tableCount === CORE_TABLE_NAMES.length &&
      indexCount === CORE_INDEX_NAMES.length &&
      foreignKeysEnabled,
  };
}
