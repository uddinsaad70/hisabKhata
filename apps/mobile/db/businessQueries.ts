// apps/mobile/db/businessQueries.ts
import { type DatabaseAdapter } from "./adapter";
import { type CurrencyCode } from "../utils/formatCurrency";
import { generateId } from "../utils/uuid";
import { SQLiteDatabase } from "expo-sqlite";

export interface BusinessRow {
  id: string;
  owner_user_id: string | null;
  name: string;
  currency: CurrencyCode;
  created_at: number;
  updated_at: number;
  is_deleted: number;
  is_synced: number;
}

export interface BusinessWithCount extends BusinessRow {
  customer_count: number;
}

export interface CreateBusinessInput {
  name: string;
  currency?: CurrencyCode;
  ownerUserId?: string | null;
}

export interface UpdateBusinessInput {
  id: string;
  name?: string;
  currency?: CurrencyCode;
}

export interface SyncStateRow {
  business_id: string;
  device_id: string;
  last_pulled_cursor: string | null;
  last_pushed_at: number;
}

const VALID_CURRENCIES: ReadonlySet<string> = new Set(["BDT", "INR"]);

function validateBusinessName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("BUSINESS_NAME_REQUIRED: Business name cannot be empty.");
  }
  return trimmed;
}

function validateCurrency(currency: string): CurrencyCode {
  if (!VALID_CURRENCIES.has(currency)) {
    throw new Error(
      `INVALID_CURRENCY: Currency must be 'BDT' or 'INR', received '${currency}'.`,
    );
  }
  return currency as CurrencyCode;
}

/**
 * Returns all active (non-deleted) businesses ordered by creation time,
 * including the count of active customers in each business.
 */
export async function getAllBusinesses(
  db: DatabaseAdapter,
): Promise<BusinessWithCount[]> {
  return db.getAllAsync<BusinessWithCount>(
    `SELECT
       b.id,
       b.owner_user_id,
       b.name,
       b.currency,
       b.created_at,
       b.updated_at,
       b.is_deleted,
       b.is_synced,
       COUNT(c.id) AS customer_count
     FROM businesses b
     LEFT JOIN customers c
       ON c.business_id = b.id AND c.is_deleted = 0
     WHERE b.is_deleted = 0
     GROUP BY b.id
     ORDER BY b.created_at ASC, b.id ASC;`,
  );
}

/**
 * Fetches a single active business by its ID.
 */
export async function getBusinessById(
  db: DatabaseAdapter,
  id: string,
): Promise<BusinessRow | null> {
  return db.getFirstAsync<BusinessRow>(
    `SELECT
       id,
       owner_user_id,
       name,
       currency,
       created_at,
       updated_at,
       is_deleted,
       is_synced
     FROM businesses
     WHERE id = ? AND is_deleted = 0;`,
    [id],
  );
}

/**
 * Creates a new business record with a UUID v7 primary key and marks is_synced = 0.
 */
export async function createBusiness(
  db: DatabaseAdapter,
  input: CreateBusinessInput,
): Promise<BusinessRow> {
  const cleanName = validateBusinessName(input.name);
  const currency = validateCurrency(input.currency ?? "BDT");
  const id = generateId();
  const now = Date.now();
  const ownerUserId = input.ownerUserId ?? null;

  await db.runAsync(
    `INSERT INTO businesses (
       id,
       owner_user_id,
       name,
       currency,
       created_at,
       updated_at,
       is_deleted,
       is_synced
     ) VALUES (?, ?, ?, ?, ?, ?, 0, 0);`,
    [id, ownerUserId, cleanName, currency, now, now],
  );

  return {
    id,
    owner_user_id: ownerUserId,
    name: cleanName,
    currency,
    created_at: now,
    updated_at: now,
    is_deleted: 0,
    is_synced: 0,
  };
}

/**
 * Updates an existing business's name and/or currency and marks is_synced = 0.
 */
export async function updateBusiness(
  db: DatabaseAdapter,
  input: UpdateBusinessInput,
): Promise<BusinessRow> {
  const existing = await getBusinessById(db, input.id);
  if (!existing) {
    throw new Error(
      `BUSINESS_NOT_FOUND: Business '${input.id}' does not exist.`,
    );
  }

  const nextName =
    input.name !== undefined ? validateBusinessName(input.name) : existing.name;
  const nextCurrency =
    input.currency !== undefined
      ? validateCurrency(input.currency)
      : existing.currency;
  const now = Date.now();

  await db.runAsync(
    `UPDATE businesses
     SET name = ?,
         currency = ?,
         updated_at = ?,
         is_synced = 0
     WHERE id = ? AND is_deleted = 0;`,
    [nextName, nextCurrency, now, input.id],
  );

  return {
    ...existing,
    name: nextName,
    currency: nextCurrency,
    updated_at: now,
    is_synced: 0,
  };
}

/**
 * Retrieves or initializes the global device sync state row ('GLOBAL').
 * Ensures a persistent UUID v7 device_id exists for this installation.
 */
export async function getOrInitDeviceSyncState(
  db: DatabaseAdapter,
): Promise<SyncStateRow> {
  const existing = await db.getFirstAsync<SyncStateRow>(
    `SELECT business_id, device_id, last_pulled_cursor, last_pushed_at
     FROM sync_state
     WHERE business_id = 'GLOBAL';`,
  );

  if (existing) {
    return existing;
  }

  const deviceId = generateId();
  await db.runAsync(
    `INSERT INTO sync_state (business_id, device_id, last_pulled_cursor, last_pushed_at)
     VALUES ('GLOBAL', ?, NULL, 0);`,
    [deviceId],
  );

  return {
    business_id: "GLOBAL",
    device_id: deviceId,
    last_pulled_cursor: null,
    last_pushed_at: 0,
  };
}

/**
 * Updates the name and currency of an existing business profile (CP15).
 */
export async function updateBusinessProfile(
  db: DatabaseAdapter,
  businessId: string,
  name: string,
  currency: CurrencyCode,
): Promise<void> {
  const trimmedName = validateBusinessName(name);
  const validCurrency = validateCurrency(currency);
  const now = Date.now();

  await db.runAsync(
    `UPDATE businesses
     SET name = ?,
         currency = ?,
         updated_at = ?,
         is_synced = 0
     WHERE id = ? AND is_deleted = 0;`,
    [trimmedName, validCurrency, now, businessId],
  );
}

/**
 * CP26/CP27: Safely prepares the local SQLite workspace for the newly authenticated serverUserId:
 * 1. Removes synced cached data belonging to any PREVIOUS different user on this phone so accounts never mix.
 * 2. Claims any unowned Guest businesses (owner_user_id IS NULL) for the current user and marks them is_synced = 0.
 * 3. Resets the pull cursor if switching between different user accounts on the same phone.
 */
export async function claimLocalBusinessesForUser(
  db: DatabaseAdapter,
  serverUserId: string,
): Promise<number> {
  const now = Date.now();
  let claimedCount = 0;

  await db.withTransactionAsync(async () => {
    // 1. Check if there are businesses belonging to a DIFFERENT previous user on this device
    const otherUserBiz = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM businesses WHERE owner_user_id IS NOT NULL AND owner_user_id != ? LIMIT 1;`,
      [serverUserId],
    );

    if (otherUserBiz) {
      await db.runAsync(
        `DELETE FROM businesses WHERE owner_user_id IS NOT NULL AND owner_user_id != ?;`,
        [serverUserId],
      );
      await db.runAsync(
        `UPDATE sync_state SET last_pulled_cursor = NULL, last_pushed_at = 0 WHERE business_id = 'GLOBAL';`,
      );
    }

    // 2. Remove empty guest placeholder businesses (0 customers and 0 cashbook entries)
    // so logging in never auto-adds 'আমার ব্যবসা' / 'My Business' to a new or existing account.
    await db.runAsync(
      `DELETE FROM businesses
       WHERE owner_user_id IS NULL
         AND name IN ('আমার ব্যবসা', 'My Business')
         AND NOT EXISTS (
           SELECT 1 FROM customers c WHERE c.business_id = businesses.id AND c.is_deleted = 0
         )
         AND NOT EXISTS (
           SELECT 1 FROM cashbook_entries ce WHERE ce.business_id = businesses.id AND ce.is_deleted = 0
         );`,
    );

    // 3. Claim any remaining Guest businesses where the user actually added data while offline
    const res = await db.runAsync(
      `UPDATE businesses
       SET owner_user_id = ?,
           is_synced = 0,
           updated_at = ?
       WHERE owner_user_id IS NULL;`,
      [serverUserId, now],
    );
    claimedCount = res.changes;

    if (claimedCount > 0) {
      await db.runAsync(
        `UPDATE customers SET is_synced = 0 WHERE business_id IN (SELECT id FROM businesses WHERE owner_user_id = ?);`,
        [serverUserId],
      );
      await db.runAsync(
        `UPDATE customer_entries SET is_synced = 0 WHERE business_id IN (SELECT id FROM businesses WHERE owner_user_id = ?);`,
        [serverUserId],
      );
      await db.runAsync(
        `UPDATE cashbook_entries SET is_synced = 0 WHERE business_id IN (SELECT id FROM businesses WHERE owner_user_id = ?);`,
        [serverUserId],
      );
    }
  });

  return claimedCount;
}

/**
 * Clears all cloud-owned user data from local SQLite immediately upon logout
 * so the previous user's customers/entries are never left behind on screen.
 * Creates a fresh Guest business (owner_user_id = NULL) if none exists.
 */
export async function clearLoggedInUserWorkspaceOnLogout(
  db: DatabaseAdapter,
  defaultBusinessName: string = "My Business",
): Promise<BusinessRow> {
  await db.withTransactionAsync(async () => {
    // Delete all businesses that belonged to a logged-in account (ON DELETE CASCADE removes their customers & entries)
    await db.runAsync(
      `DELETE FROM businesses WHERE owner_user_id IS NOT NULL;`,
    );
    await db.runAsync(
      `UPDATE sync_state SET last_pulled_cursor = NULL, last_pushed_at = 0 WHERE business_id = 'GLOBAL';`,
    );
  });

  const remaining = await getAllBusinesses(db);
  if (remaining.length > 0) {
    return remaining[0];
  }

  return createBusiness(db, {
    name: defaultBusinessName,
    currency: "BDT",
    ownerUserId: null,
  });
}

/**
 * Soft-deletes a business and all its associated customers, customer ledger entries,
 * and cashbook entries (marking is_deleted = 1, is_synced = 0 so cloud sync propagates deletion).
 * Ensures at least one active business remains. Returns the next active business.
 */
export async function deleteBusiness(
  db: DatabaseAdapter,
  businessId: string,
): Promise<BusinessWithCount> {
  const allActive = await getAllBusinesses(db);
  if (allActive.length <= 1) {
    throw new Error("CANNOT_DELETE_LAST_BUSINESS");
  }

  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE customer_entries
       SET is_deleted = 1, is_synced = 0, updated_at = ?
       WHERE business_id = ? AND is_deleted = 0;`,
      [now, businessId],
    );

    await db.runAsync(
      `UPDATE customers
       SET is_deleted = 1, is_synced = 0, updated_at = ?
       WHERE business_id = ? AND is_deleted = 0;`,
      [now, businessId],
    );

    await db.runAsync(
      `UPDATE cashbook_entries
       SET is_deleted = 1, is_synced = 0, updated_at = ?
       WHERE business_id = ? AND is_deleted = 0;`,
      [now, businessId],
    );

    await db.runAsync(
      `UPDATE businesses
       SET is_deleted = 1, is_synced = 0, updated_at = ?
       WHERE id = ? AND is_deleted = 0;`,
      [now, businessId],
    );
  });

  const remaining = await getAllBusinesses(db);
  return remaining[0];
}