// apps/mobile/db/cashbookQueries.ts
import { type DatabaseAdapter } from "./adapter";
import { roundMoney } from "../utils/formatCurrency";
import { generateId } from "../utils/uuid";

export type CashbookEntryType = "OUT" | "IN";
export type PaymentMode = "CASH" | "ONLINE";

export interface CashbookEntryRow {
  id: string;
  business_id: string;
  type: CashbookEntryType;
  payment_mode: PaymentMode;
  amount: number;
  details: string | null;
  entry_date: string; // 'YYYY-MM-DD'
  entry_time: string; // '06:50 PM'
  timestamp: number;
  created_at: number;
  updated_at: number;
  is_deleted: number;
  is_synced: number;
}

export interface CashbookDashboardSummary {
  total_cash: number;
  total_online: number;
  total_balance: number;
  today_cash: number;
  today_online: number;
  today_balance: number;
  today_in_total: number;
  today_out_total: number;
  today_entry_count: number;
}

export interface CashbookDailyReportRow {
  entry_date: string;
  daily_in: number;
  daily_out: number;
  daily_balance: number;
  total_balance: number;
  entry_count: number;
}

export interface AddCashbookEntryInput {
  businessId: string;
  type: CashbookEntryType;
  paymentMode?: PaymentMode;
  amount: number;
  details?: string | null;
  entryDate: string; // 'YYYY-MM-DD'
  entryTime: string; // '06:50 PM'
  timestamp?: number;
}

export interface UpdateCashbookEntryInput {
  entryId: string;
  businessId: string;
  type?: CashbookEntryType;
  paymentMode?: PaymentMode;
  amount?: number;
  details?: string | null;
  entryDate?: string;
  entryTime?: string;
  timestamp?: number;
}

const MAX_ALLOWED_AMOUNT = 999999999.99;
const VALID_CASHBOOK_TYPES: ReadonlySet<string> = new Set(["OUT", "IN"]);
const VALID_PAYMENT_MODES: ReadonlySet<string> = new Set(["CASH", "ONLINE"]);

function validateCashbookType(type: string): CashbookEntryType {
  if (!VALID_CASHBOOK_TYPES.has(type)) {
    throw new Error(
      `INVALID_CASHBOOK_TYPE: Expected 'OUT' or 'IN', received '${type}'.`,
    );
  }
  return type as CashbookEntryType;
}

function validatePaymentMode(mode: string): PaymentMode {
  if (!VALID_PAYMENT_MODES.has(mode)) {
    throw new Error(
      `INVALID_PAYMENT_MODE: Expected 'CASH' or 'ONLINE', received '${mode}'.`,
    );
  }
  return mode as PaymentMode;
}

function validateAndRoundAmount(amount: number): number {
  const rounded = roundMoney(amount);
  if (!Number.isFinite(rounded) || rounded <= 0) {
    throw new Error("INVALID_AMOUNT: Cashbook amount must be greater than 0.");
  }
  if (rounded > MAX_ALLOWED_AMOUNT) {
    throw new Error(
      `AMOUNT_TOO_LARGE: Cashbook amount cannot exceed ${MAX_ALLOWED_AMOUNT}.`,
    );
  }
  return rounded;
}

/**
 * Returns the Cashbook Dashboard Summary (Total Balance, Today's Balance,
 * Cash in Hand vs Online split, and Today's IN/OUT totals)
 * according to Specification Section 6.5.1(a).
 */
export async function getCashbookDashboardSummary(
  db: DatabaseAdapter,
  businessId: string,
  todayDate: string,
): Promise<CashbookDashboardSummary> {
  const row = await db.getFirstAsync<CashbookDashboardSummary>(
    `SELECT
       ROUND(COALESCE(SUM(CASE WHEN payment_mode = 'CASH'   THEN (CASE WHEN type = 'IN' THEN amount ELSE -amount END) ELSE 0 END), 0), 2) AS total_cash,
       ROUND(COALESCE(SUM(CASE WHEN payment_mode = 'ONLINE' THEN (CASE WHEN type = 'IN' THEN amount ELSE -amount END) ELSE 0 END), 0), 2) AS total_online,
       ROUND(COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE -amount END), 0), 2) AS total_balance,
       ROUND(COALESCE(SUM(CASE WHEN entry_date = ? AND payment_mode = 'CASH'   THEN (CASE WHEN type = 'IN' THEN amount ELSE -amount END) ELSE 0 END), 0), 2) AS today_cash,
       ROUND(COALESCE(SUM(CASE WHEN entry_date = ? AND payment_mode = 'ONLINE' THEN (CASE WHEN type = 'IN' THEN amount ELSE -amount END) ELSE 0 END), 0), 2) AS today_online,
       ROUND(COALESCE(SUM(CASE WHEN entry_date = ? THEN (CASE WHEN type = 'IN' THEN amount ELSE -amount END) ELSE 0 END), 0), 2) AS today_balance,
       ROUND(COALESCE(SUM(CASE WHEN entry_date = ? AND type = 'IN'  THEN amount ELSE 0 END), 0), 2) AS today_in_total,
       ROUND(COALESCE(SUM(CASE WHEN entry_date = ? AND type = 'OUT' THEN amount ELSE 0 END), 0), 2) AS today_out_total,
       COUNT(CASE WHEN entry_date = ? THEN 1 END) AS today_entry_count
     FROM cashbook_entries
     WHERE business_id = ? AND is_deleted = 0;`,
    [
      todayDate,
      todayDate,
      todayDate,
      todayDate,
      todayDate,
      todayDate,
      businessId,
    ],
  );

  return {
    total_cash: row?.total_cash ?? 0,
    total_online: row?.total_online ?? 0,
    total_balance: row?.total_balance ?? 0,
    today_cash: row?.today_cash ?? 0,
    today_online: row?.today_online ?? 0,
    today_balance: row?.today_balance ?? 0,
    today_in_total: row?.today_in_total ?? 0,
    today_out_total: row?.today_out_total ?? 0,
    today_entry_count: row?.today_entry_count ?? 0,
  };
}

/**
 * Fetches all active cashbook entries for a given business and date, ordered newest-first.
 */
export async function getCashbookEntriesByDate(
  db: DatabaseAdapter,
  businessId: string,
  entryDate: string,
): Promise<CashbookEntryRow[]> {
  return db.getAllAsync<CashbookEntryRow>(
    `SELECT *
     FROM cashbook_entries
     WHERE business_id = ?
       AND entry_date = ?
       AND is_deleted = 0
     ORDER BY timestamp DESC, id DESC;`,
    [businessId, entryDate],
  );
}

/**
 * Fetches a single cashbook entry by ID.
 */
export async function getCashbookEntryById(
  db: DatabaseAdapter,
  businessId: string,
  entryId: string,
  includeDeleted: boolean = false,
): Promise<CashbookEntryRow | null> {
  const deletedFilter = includeDeleted ? "" : "AND is_deleted = 0";
  return db.getFirstAsync<CashbookEntryRow>(
    `SELECT *
     FROM cashbook_entries
     WHERE id = ? AND business_id = ? ${deletedFilter};`,
    [entryId, businessId],
  );
}

/**
 * Adds a new cashbook entry (- OUT or + IN) with 2-decimal rounding.
 */
export async function addCashbookEntry(
  db: DatabaseAdapter,
  input: AddCashbookEntryInput,
): Promise<CashbookEntryRow> {
  const type = validateCashbookType(input.type);
  const paymentMode = validatePaymentMode(input.paymentMode ?? "CASH");
  const amount = validateAndRoundAmount(input.amount);
  const details = input.details?.trim() ? input.details.trim() : null;
  const id = generateId();
  const now = Date.now();
  const timestamp = input.timestamp ?? now;

  await db.runAsync(
    `INSERT INTO cashbook_entries (
       id,
       business_id,
       type,
       payment_mode,
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
      type,
      paymentMode,
      amount,
      details,
      input.entryDate,
      input.entryTime,
      timestamp,
      now,
      now,
    ],
  );

  return {
    id,
    business_id: input.businessId,
    type,
    payment_mode: paymentMode,
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
 * Updates an existing cashbook entry (amount, payment_mode, details, date, or type).
 */
export async function updateCashbookEntry(
  db: DatabaseAdapter,
  input: UpdateCashbookEntryInput,
): Promise<CashbookEntryRow> {
  const existing = await getCashbookEntryById(
    db,
    input.businessId,
    input.entryId,
    false,
  );
  if (!existing) {
    throw new Error(
      `CASHBOOK_ENTRY_NOT_FOUND: Entry '${input.entryId}' does not exist.`,
    );
  }

  const nextType =
    input.type !== undefined ? validateCashbookType(input.type) : existing.type;
  const nextMode =
    input.paymentMode !== undefined
      ? validatePaymentMode(input.paymentMode)
      : existing.payment_mode;
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
  const nextDate = input.entryDate ?? existing.entry_date;
  const nextTime = input.entryTime ?? existing.entry_time;
  const nextTimestamp = input.timestamp ?? existing.timestamp;
  const now = Date.now();

  await db.runAsync(
    `UPDATE cashbook_entries
     SET type = ?,
         payment_mode = ?,
         amount = ?,
         details = ?,
         entry_date = ?,
         entry_time = ?,
         timestamp = ?,
         updated_at = ?,
         is_synced = 0
     WHERE id = ? AND business_id = ? AND is_deleted = 0;`,
    [
      nextType,
      nextMode,
      nextAmount,
      nextDetails,
      nextDate,
      nextTime,
      nextTimestamp,
      now,
      input.entryId,
      input.businessId,
    ],
  );

  return {
    ...existing,
    type: nextType,
    payment_mode: nextMode,
    amount: nextAmount,
    details: nextDetails,
    entry_date: nextDate,
    entry_time: nextTime,
    timestamp: nextTimestamp,
    updated_at: now,
    is_synced: 0,
  };
}

/**
 * Soft-deletes a cashbook entry (`is_deleted = 1, is_synced = 0`).
 */
export async function softDeleteCashbookEntry(
  db: DatabaseAdapter,
  businessId: string,
  entryId: string,
): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `UPDATE cashbook_entries
     SET is_deleted = 1,
         updated_at = ?,
         is_synced = 0
     WHERE id = ? AND business_id = ? AND is_deleted = 0;`,
    [now, entryId, businessId],
  );
}

/**
 * Restores a recently soft-deleted cashbook entry (`is_deleted = 0, is_synced = 0`)
 * when the user taps [UNDO] on the 5-second snackbar.
 */
export async function undoDeleteCashbookEntry(
  db: DatabaseAdapter,
  businessId: string,
  entryId: string,
): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `UPDATE cashbook_entries
     SET is_deleted = 0,
         updated_at = ?,
         is_synced = 0
     WHERE id = ? AND business_id = ? AND is_deleted = 1;`,
    [now, entryId, businessId],
  );
}

/**
 * Computes date-wise Daily Balance and Cumulative Total Balance using CTE + Window Function
 * (Specification Section 6.5.1(b)).
 * Note: `cumulative_summary` computes running `total_balance` from the beginning of time
 * BEFORE filtering by `BETWEEN :startDate AND :endDate` so mid-month filters still show
 * accurate cumulative balances including prior dates.
 */
export async function getCashbookDailyReport(
  db: DatabaseAdapter,
  businessId: string,
  startDate: string,
  endDate: string,
): Promise<CashbookDailyReportRow[]> {
  return db.getAllAsync<CashbookDailyReportRow>(
    `WITH daily_summary AS (
       SELECT
         entry_date,
         ROUND(SUM(CASE WHEN type = 'IN'  THEN amount ELSE 0 END), 2) AS daily_in,
         ROUND(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 2) AS daily_out,
         ROUND(SUM(CASE WHEN type = 'IN'  THEN amount ELSE -amount END), 2) AS daily_balance,
         COUNT(id) AS entry_count
       FROM cashbook_entries
       WHERE business_id = ? AND is_deleted = 0
       GROUP BY entry_date
     ),
     cumulative_summary AS (
       SELECT
         entry_date,
         daily_in,
         daily_out,
         daily_balance,
         ROUND(SUM(daily_balance) OVER (ORDER BY entry_date ASC), 2) AS total_balance,
         entry_count
       FROM daily_summary
     )
     SELECT
       entry_date,
       daily_in,
       daily_out,
       daily_balance,
       total_balance,
       entry_count
     FROM cumulative_summary
     WHERE entry_date BETWEEN ? AND ?
     ORDER BY entry_date DESC;`,
    [businessId, startDate, endDate],
  );
}
