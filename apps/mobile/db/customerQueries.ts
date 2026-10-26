// apps/mobile/db/customerQueries.ts
import { type DatabaseAdapter, type SqlBindParam } from "./adapter";
import { type CustomerFilter, type CustomerSort } from "../store/uiStore";
import { roundMoney } from "../utils/formatCurrency";
import { generateId } from "../utils/uuid";

export type CustomerEntryType = "GAVE" | "GOT";

export interface CustomerRow {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  avatar_initials: string;
  net_balance: number;
  last_transaction_at: number | null;
  created_at: number;
  updated_at: number;
  is_deleted: number;
  is_synced: number;
}

export interface CustomerLedgerEntryRow {
  id: string;
  business_id: string;
  customer_id: string;
  type: CustomerEntryType;
  amount: number;
  details: string | null;
  entry_date: string;
  entry_time: string;
  timestamp: number;
  created_at: number;
  updated_at: number;
  is_deleted: number;
  is_synced: number;
  running_balance: number;
}

export interface CustomerEntryRow {
  id: string;
  business_id: string;
  customer_id: string;
  type: CustomerEntryType;
  amount: number;
  details: string | null;
  entry_date: string;
  entry_time: string;
  timestamp: number;
  created_at: number;
  updated_at: number;
  is_deleted: number;
  is_synced: number;
}

export interface CustomersHomeSummary {
  totalYouWillGive: number; // Green: sum of positive net_balance (> 0.005)
  totalYouWillGet: number; // Red: absolute sum of negative net_balance (< -0.005)
  activeCustomerCount: number;
}

export interface CustomersWithSummaryResult {
  customers: CustomerRow[];
  summary: CustomersHomeSummary;
}

export interface CreateCustomerInput {
  businessId: string;
  name: string;
  phone?: string | null;
}

export interface UpdateCustomerInput {
  id: string;
  businessId: string;
  name?: string;
  phone?: string | null;
}

export interface GetCustomersQueryOptions {
  businessId: string;
  searchQuery?: string;
  filter?: CustomerFilter;
  sort?: CustomerSort;
}

export interface AddCustomerEntryInput {
  businessId: string;
  customerId: string;
  type: CustomerEntryType;
  amount: number;
  details?: string | null;
  entryDate: string; // 'YYYY-MM-DD'
  entryTime: string; // '11:56 AM'
  timestamp?: number;
}

export interface UpdateCustomerEntryInput {
  entryId: string;
  businessId: string;
  customerId: string;
  type?: CustomerEntryType;
  amount?: number;
  details?: string | null;
  entryDate?: string;
  entryTime?: string;
  timestamp?: number;
}

const MAX_ALLOWED_AMOUNT = 999999999.99;
const VALID_ENTRY_TYPES: ReadonlySet<string> = new Set(["GAVE", "GOT"]);

/**
 * Generates up to 2 uppercase initials from a customer's name.
 * Example: "Younus Mg" -> "YM", "Hasina" -> "HA"
 */
export function getAvatarInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) {
    return "C";
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function validateCustomerName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("CUSTOMER_NAME_REQUIRED: Customer name cannot be empty.");
  }
  return trimmed;
}

function normalizePhone(phone?: string | null): string | null {
  if (phone === undefined || phone === null) {
    return null;
  }
  const trimmed = phone.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateEntryType(type: string): CustomerEntryType {
  if (!VALID_ENTRY_TYPES.has(type)) {
    throw new Error(
      `INVALID_ENTRY_TYPE: Expected 'GAVE' or 'GOT', received '${type}'.`,
    );
  }
  return type as CustomerEntryType;
}

function validateAndRoundAmount(amount: number): number {
  const rounded = roundMoney(amount);
  if (!Number.isFinite(rounded) || rounded <= 0) {
    throw new Error("INVALID_AMOUNT: Entry amount must be greater than 0.");
  }
  if (rounded > MAX_ALLOWED_AMOUNT) {
    throw new Error(
      `AMOUNT_TOO_LARGE: Entry amount cannot exceed ${MAX_ALLOWED_AMOUNT}.`,
    );
  }
  return rounded;
}

/**
 * Checks if another active customer in the same business already uses the given phone number.
 * Returns the existing CustomerRow if found, or null otherwise.
 */
export async function checkDuplicatePhone(
  db: DatabaseAdapter,
  businessId: string,
  phone: string | null | undefined,
  excludeCustomerId?: string,
): Promise<CustomerRow | null> {
  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone) {
    return null;
  }

  if (excludeCustomerId) {
    return db.getFirstAsync<CustomerRow>(
      `SELECT *
       FROM customers
       WHERE business_id = ?
         AND phone = ?
         AND is_deleted = 0
         AND id != ?
       LIMIT 1;`,
      [businessId, cleanPhone, excludeCustomerId],
    );
  }

  return db.getFirstAsync<CustomerRow>(
    `SELECT *
     FROM customers
     WHERE business_id = ?
       AND phone = ?
       AND is_deleted = 0
     LIMIT 1;`,
    [businessId, cleanPhone],
  );
}

/**
 * Fetches a single active customer by ID and business ID.
 */
export async function getCustomerById(
  db: DatabaseAdapter,
  businessId: string,
  customerId: string,
): Promise<CustomerRow | null> {
  return db.getFirstAsync<CustomerRow>(
    `SELECT *
     FROM customers
     WHERE id = ? AND business_id = ? AND is_deleted = 0;`,
    [customerId, businessId],
  );
}

/**
 * Creates a new customer inside a business with a UUID v7 primary key.
 */
export async function createCustomer(
  db: DatabaseAdapter,
  input: CreateCustomerInput,
): Promise<CustomerRow> {
  const cleanName = validateCustomerName(input.name);
  const cleanPhone = normalizePhone(input.phone);
  const initials = getAvatarInitials(cleanName);
  const id = generateId();
  const now = Date.now();

  await db.runAsync(
    `INSERT INTO customers (
       id,
       business_id,
       name,
       phone,
       avatar_initials,
       net_balance,
       last_transaction_at,
       created_at,
       updated_at,
       is_deleted,
       is_synced
     ) VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, 0, 0);`,
    [id, input.businessId, cleanName, cleanPhone, initials, now, now],
  );

  return {
    id,
    business_id: input.businessId,
    name: cleanName,
    phone: cleanPhone,
    avatar_initials: initials,
    net_balance: 0,
    last_transaction_at: null,
    created_at: now,
    updated_at: now,
    is_deleted: 0,
    is_synced: 0,
  };
}

/**
 * Updates an existing customer's name and/or phone number and marks is_synced = 0.
 */
export async function updateCustomer(
  db: DatabaseAdapter,
  input: UpdateCustomerInput,
): Promise<CustomerRow> {
  const existing = await getCustomerById(db, input.businessId, input.id);
  if (!existing) {
    throw new Error(
      `CUSTOMER_NOT_FOUND: Customer '${input.id}' does not exist in business '${input.businessId}'.`,
    );
  }

  const nextName =
    input.name !== undefined ? validateCustomerName(input.name) : existing.name;
  const nextPhone =
    input.phone !== undefined ? normalizePhone(input.phone) : existing.phone;
  const nextInitials = getAvatarInitials(nextName);
  const now = Date.now();

  await db.runAsync(
    `UPDATE customers
     SET name = ?,
         phone = ?,
         avatar_initials = ?,
         updated_at = ?,
         is_synced = 0
     WHERE id = ? AND business_id = ? AND is_deleted = 0;`,
    [nextName, nextPhone, nextInitials, now, input.id, input.businessId],
  );

  return {
    ...existing,
    name: nextName,
    phone: nextPhone,
    avatar_initials: nextInitials,
    updated_at: now,
    is_synced: 0,
  };
}

/**
 * Recomputes a customer's derived local cache (`net_balance` and `last_transaction_at`)
 * from active `customer_entries` WITHOUT modifying `updated_at` or `is_synced`
 * (Specification Section 6.5.3).
 */
export async function recomputeBalance(
  db: DatabaseAdapter,
  businessId: string,
  customerId: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE customers
     SET net_balance = COALESCE((
           SELECT ROUND(SUM(CASE WHEN type = 'GOT' THEN amount ELSE -amount END), 2)
           FROM customer_entries
           WHERE business_id = ? AND customer_id = ? AND is_deleted = 0
         ), 0),
         last_transaction_at = (
           SELECT MAX(timestamp)
           FROM customer_entries
           WHERE business_id = ? AND customer_id = ? AND is_deleted = 0
         )
     WHERE id = ? AND business_id = ?;`,
    [businessId, customerId, businessId, customerId, customerId, businessId],
  );
}

/**
 * Returns the overall Home Summary Card totals (`You will give` & `You will get`)
 * across all active customers in the business, plus the filtered/sorted customer list.
 */
export async function getCustomersWithSummary(
  db: DatabaseAdapter,
  options: GetCustomersQueryOptions,
): Promise<CustomersWithSummaryResult> {
  const {
    businessId,
    searchQuery = "",
    filter = "ALL",
    sort = "MOST_RECENT",
  } = options;

  const summaryRow = await db.getFirstAsync<{
    total_you_will_give: number;
    total_you_will_get: number;
    active_customer_count: number;
  }>(
    `SELECT
       ROUND(COALESCE(SUM(CASE WHEN net_balance >= 0.005 THEN net_balance ELSE 0 END), 0), 2) AS total_you_will_give,
       ROUND(COALESCE(SUM(CASE WHEN net_balance <= -0.005 THEN ABS(net_balance) ELSE 0 END), 0), 2) AS total_you_will_get,
       COUNT(id) AS active_customer_count
     FROM customers
     WHERE business_id = ? AND is_deleted = 0;`,
    [businessId],
  );

  const whereClauses: string[] = ["business_id = ?", "is_deleted = 0"];
  const params: SqlBindParam[] = [businessId];

  const trimmedSearch = searchQuery.trim();
  if (trimmedSearch.length > 0) {
    whereClauses.push(
      "(name LIKE ? COLLATE NOCASE OR COALESCE(phone, '') LIKE ?)",
    );
    const likePattern = `%${trimmedSearch}%`;
    params.push(likePattern, likePattern);
  }

  if (filter === "YOU_WILL_GET") {
    // Customer owes merchant -> net_balance is negative
    whereClauses.push("net_balance <= -0.005");
  } else if (filter === "YOU_WILL_GIVE") {
    // Merchant owes customer -> net_balance is positive
    whereClauses.push("net_balance >= 0.005");
  } else if (filter === "SETTLED") {
    whereClauses.push("ABS(net_balance) < 0.005");
  }

  let orderByClause =
    "COALESCE(last_transaction_at, created_at) DESC, updated_at DESC, id DESC";
  if (sort === "OLDEST") {
    orderByClause =
      "COALESCE(last_transaction_at, created_at) ASC, created_at ASC, id ASC";
  } else if (sort === "HIGHEST_AMOUNT") {
    orderByClause = "ABS(net_balance) DESC, name COLLATE NOCASE ASC, id ASC";
  } else if (sort === "NAME_AZ") {
    orderByClause = "name COLLATE NOCASE ASC, id ASC";
  }

  const customers = await db.getAllAsync<CustomerRow>(
    `SELECT *
     FROM customers
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY ${orderByClause};`,
    params,
  );

  return {
    customers,
    summary: {
      totalYouWillGive: summaryRow?.total_you_will_give ?? 0,
      totalYouWillGet: summaryRow?.total_you_will_get ?? 0,
      activeCustomerCount: summaryRow?.active_customer_count ?? 0,
    },
  };
}

/**
 * Fetches all active ledger entries for a customer with SQLite Window Function
 * `running_balance` (`Bal.`), ordered newest-first for ledger display
 * (Specification Section 6.5.2).
 */
export async function getCustomerLedgerEntries(
  db: DatabaseAdapter,
  businessId: string,
  customerId: string,
): Promise<CustomerLedgerEntryRow[]> {
  return db.getAllAsync<CustomerLedgerEntryRow>(
    `SELECT
       id,
       business_id,
       customer_id,
       type,
       amount,
       details,
       entry_date,
       entry_time,
       timestamp,
       created_at,
       updated_at,
       is_deleted,
       is_synced,
       ROUND(
         SUM(CASE WHEN type = 'GOT' THEN amount ELSE -amount END)
         OVER (
           PARTITION BY customer_id
           ORDER BY entry_date ASC, timestamp ASC, id ASC
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         ),
         2
       ) AS running_balance
     FROM customer_entries
     WHERE business_id = ?
       AND customer_id = ?
       AND is_deleted = 0
     ORDER BY entry_date DESC, timestamp DESC, id DESC;`,
    [businessId, customerId],
  );
}

/**
 * Fetches a single customer entry by ID (including soft-deleted ones if needed for undo).
 */
export async function getCustomerEntryById(
  db: DatabaseAdapter,
  businessId: string,
  entryId: string,
  includeDeleted: boolean = false,
): Promise<CustomerEntryRow | null> {
  const deletedFilter = includeDeleted ? "" : "AND is_deleted = 0";
  return db.getFirstAsync<CustomerEntryRow>(
    `SELECT *
     FROM customer_entries
     WHERE id = ? AND business_id = ? ${deletedFilter};`,
    [entryId, businessId],
  );
}

/**
 * Adds a new customer ledger entry (GAVE or GOT), rounds the amount to 2 decimals,
 * and recomputes the customer's cached net_balance inside a single transaction.
 */
export async function addCustomerEntry(
  db: DatabaseAdapter,
  input: AddCustomerEntryInput,
): Promise<CustomerEntryRow> {
  const type = validateEntryType(input.type);
  const amount = validateAndRoundAmount(input.amount);
  const details = input.details?.trim() ? input.details.trim() : null;
  const id = generateId();
  const now = Date.now();
  const timestamp = input.timestamp ?? now;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO customer_entries (
         id,
         business_id,
         customer_id,
         type,
         amount,
         details,
         entry_date,
         entry_time,
         timestamp,
         created_at,
         updated_at,
         is_deleted,
         is_synced
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0);`,
      [
        id,
        input.businessId,
        input.customerId,
        type,
        amount,
        details,
        input.entryDate,
        input.entryTime,
        timestamp,
        now,
        now,
      ],
    );

    await recomputeBalance(db, input.businessId, input.customerId);
  });

  return {
    id,
    business_id: input.businessId,
    customer_id: input.customerId,
    type,
    amount,
    details,
    entry_date: input.entryDate,
    entry_time: input.entryTime,
    timestamp,
    created_at: now,
    updated_at: now,
    is_deleted: 0,
    is_synced: 0,
  };
}

/**
 * Updates an existing customer ledger entry and recomputes the customer's net_balance
 * inside the same transaction.
 */
export async function updateCustomerEntry(
  db: DatabaseAdapter,
  input: UpdateCustomerEntryInput,
): Promise<CustomerEntryRow> {
  const existing = await getCustomerEntryById(
    db,
    input.businessId,
    input.entryId,
    false,
  );
  if (!existing || existing.customer_id !== input.customerId) {
    throw new Error(
      `CUSTOMER_ENTRY_NOT_FOUND: Entry '${input.entryId}' does not exist.`,
    );
  }

  const nextType =
    input.type !== undefined ? validateEntryType(input.type) : existing.type;
  const nextAmount =
    input.amount !== undefined
      ? validateAndRoundAmount(input.amount)
      : existing.amount;
  const nextDetails =
    input.details !== undefined
      ? input.details?.trim()
        ? input.details.trim()
        : null
      : existing.details;
  const nextEntryDate = input.entryDate ?? existing.entry_date;
  const nextEntryTime = input.entryTime ?? existing.entry_time;
  const nextTimestamp = input.timestamp ?? existing.timestamp;
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE customer_entries
       SET type = ?,
           amount = ?,
           details = ?,
           entry_date = ?,
           entry_time = ?,
           timestamp = ?,
           updated_at = ?,
           is_synced = 0
       WHERE id = ? AND business_id = ? AND customer_id = ? AND is_deleted = 0;`,
      [
        nextType,
        nextAmount,
        nextDetails,
        nextEntryDate,
        nextEntryTime,
        nextTimestamp,
        now,
        input.entryId,
        input.businessId,
        input.customerId,
      ],
    );

    await recomputeBalance(db, input.businessId, input.customerId);
  });

  return {
    ...existing,
    type: nextType,
    amount: nextAmount,
    details: nextDetails,
    entry_date: nextEntryDate,
    entry_time: nextEntryTime,
    timestamp: nextTimestamp,
    updated_at: now,
    is_synced: 0,
  };
}

/**
 * Soft-deletes a single customer entry (`is_deleted = 1, is_synced = 0`)
 * and recomputes the customer's balance in a single transaction.
 */
export async function softDeleteCustomerEntry(
  db: DatabaseAdapter,
  businessId: string,
  customerId: string,
  entryId: string,
): Promise<void> {
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE customer_entries
       SET is_deleted = 1,
           updated_at = ?,
           is_synced = 0
       WHERE id = ? AND business_id = ? AND customer_id = ? AND is_deleted = 0;`,
      [now, entryId, businessId, customerId],
    );

    await recomputeBalance(db, businessId, customerId);
  });
}

/**
 * Restores a recently soft-deleted customer entry (`is_deleted = 0, is_synced = 0`)
 * when the user taps [UNDO] on the 5-second snackbar, and recomputes the balance.
 */
export async function undoDeleteCustomerEntry(
  db: DatabaseAdapter,
  businessId: string,
  customerId: string,
  entryId: string,
): Promise<void> {
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE customer_entries
       SET is_deleted = 0,
           updated_at = ?,
           is_synced = 0
       WHERE id = ? AND business_id = ? AND customer_id = ? AND is_deleted = 1;`,
      [now, entryId, businessId, customerId],
    );

    await recomputeBalance(db, businessId, customerId);
  });
}

/**
 * Cascade soft-deletes a customer and all of their currently active entries
 * (`WHERE is_deleted = 0`) in a single atomic transaction using the same `batchNow`
 * timestamp so previously deleted entries do not have their `updated_at` overwritten
 * (Specification Sections 0.2 & 6.5.4).
 */
export async function softDeleteCustomerCascade(
  db: DatabaseAdapter,
  businessId: string,
  customerId: string,
): Promise<void> {
  const batchNow = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE customer_entries
       SET is_deleted = 1,
           updated_at = ?,
           is_synced = 0
       WHERE business_id = ? AND customer_id = ? AND is_deleted = 0;`,
      [batchNow, businessId, customerId],
    );

    await db.runAsync(
      `UPDATE customers
       SET is_deleted = 1,
           net_balance = 0,
           updated_at = ?,
           is_synced = 0
       WHERE id = ? AND business_id = ? AND is_deleted = 0;`,
      [batchNow, customerId, businessId],
    );
  });
}
