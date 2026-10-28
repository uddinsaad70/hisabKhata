// apps/mobile/db/businessQueries.ts
import { type DatabaseAdapter } from "./adapter";
import { type CurrencyCode } from "../utils/formatCurrency";
import { generateId } from "../utils/uuid";

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
