// apps/mobile/utils/backupService.ts
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import { File as ExpoFile } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { type DatabaseAdapter } from "../db/adapter";
import { getLocalDateString } from "./dateUtils";

export interface BackupStats {
  totalCustomers: number;
  totalCustomerEntries: number;
  totalCashbookEntries: number;
  unsyncedCount: number;
}

/**
 * Helper to read text content from a picked document URI safely inside Expo Go on Android/iOS.
 */
async function readPickedFileText(uri: string): Promise<string> {
  try {
    const file = new ExpoFile(uri);
    const text = await file.text();
    if (text) return text;
  } catch {
    // Fallback to next method
  }

  try {
    return await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  } catch {
    // Fallback to next method
  }

  const response = await fetch(uri);
  return await response.text();
}

/**
 * Queries SQLite for total active records and unsynced record counts for the active business.
 */
export async function getBusinessBackupStats(
  db: DatabaseAdapter,
  businessId: string,
): Promise<BackupStats> {
  const custRow = await db.getFirstAsync<{ cnt: number; unsynced: number }>(
    `SELECT
       COUNT(CASE WHEN is_deleted = 0 THEN 1 END) AS cnt,
       COUNT(CASE WHEN is_deleted = 0 AND is_synced = 0 THEN 1 END) AS unsynced
     FROM customers
     WHERE business_id = ?;`,
    [businessId],
  );

  const ceRow = await db.getFirstAsync<{ cnt: number; unsynced: number }>(
    `SELECT
       COUNT(CASE WHEN is_deleted = 0 THEN 1 END) AS cnt,
       COUNT(CASE WHEN is_deleted = 0 AND is_synced = 0 THEN 1 END) AS unsynced
     FROM customer_entries
     WHERE business_id = ?;`,
    [businessId],
  );

  const cbRow = await db.getFirstAsync<{ cnt: number; unsynced: number }>(
    `SELECT
       COUNT(CASE WHEN is_deleted = 0 THEN 1 END) AS cnt,
       COUNT(CASE WHEN is_deleted = 0 AND is_synced = 0 THEN 1 END) AS unsynced
     FROM cashbook_entries
     WHERE business_id = ?;`,
    [businessId],
  );
  const totalCustomers = custRow?.cnt ?? 0;
  const totalCustomerEntries = ceRow?.cnt ?? 0;
  const totalCashbookEntries = cbRow?.cnt ?? 0;
  const unsyncedCount =
    (custRow?.unsynced ?? 0) + (ceRow?.unsynced ?? 0) + (cbRow?.unsynced ?? 0);

  return {
    totalCustomers,
    totalCustomerEntries,
    totalCashbookEntries,
    unsyncedCount,
  };
}

/**
 * Exports all SQLite tables for the active business into a timestamped JSON file
 * and triggers the native OS Share sheet (Save to Drive, WhatsApp, Files, etc.).
 */
export async function exportBusinessBackupJson(
  db: DatabaseAdapter,
  businessId: string,
  businessName: string,
): Promise<void> {
  const business = await db.getFirstAsync(
    `SELECT * FROM businesses WHERE id = ?;`,
    [businessId],
  );
  const customers = await db.getAllAsync(
    `SELECT * FROM customers WHERE business_id = ? AND is_deleted = 0;`,
    [businessId],
  );
  const customerEntries = await db.getAllAsync(
    `SELECT * FROM customer_entries WHERE business_id = ? AND is_deleted = 0;`,
    [businessId],
  );
  const cashbookEntries = await db.getAllAsync(
    `SELECT * FROM cashbook_entries WHERE business_id = ? AND is_deleted = 0;`,
    [businessId],
  );

  const payload = {
    app: "HisabKhata",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    business,
    customers,
    customerEntries,
    cashbookEntries,
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const safeName = businessName.replace(/[^a-zA-Z0-9_-]/g, "_") || "Business";
  const dateStr = getLocalDateString(new Date());
  const fileName = `HisabKhata_Backup_${safeName}_${dateStr}.json`;

  const baseDir =
    FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? "";
  if (!baseDir) {
    throw new Error("Local file system directory is unavailable.");
  }

  const fileUri = `${baseDir}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, jsonString, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: "application/json",
      dialogTitle: `Backup - ${businessName}`,
      UTI: "public.json",
    });
  }

  // Mark all active records of this business as backed up (is_synced = 1)
  await db.runAsync(`UPDATE businesses SET is_synced = 1 WHERE id = ?;`, [
    businessId,
  ]);
  await db.runAsync(
    `UPDATE customers SET is_synced = 1 WHERE business_id = ? AND is_deleted = 0;`,
    [businessId],
  );
  await db.runAsync(
    `UPDATE customer_entries SET is_synced = 1 WHERE business_id = ? AND is_deleted = 0;`,
    [businessId],
  );
  await db.runAsync(
    `UPDATE cashbook_entries SET is_synced = 1 WHERE business_id = ? AND is_deleted = 0;`,
    [businessId],
  );
}

export interface RestoreBackupResult {
  restored: boolean;
  businessId?: string;
  businessName?: string;
  currency?: "BDT" | "INR";
  customersCount?: number;
  entriesCount?: number;
}

/**
 * Opens the system document picker to select a HisabKhata JSON backup file
 * and restores all business, customer, and cashbook records into SQLite.
 */
export async function pickAndRestoreBackupJson(
  db: DatabaseAdapter,
): Promise<RestoreBackupResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "*/*"],
    copyToCacheDirectory: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { restored: false };
  }

  const fileUri = result.assets[0].uri;
  const rawJson = await readPickedFileText(fileUri);

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Invalid file format. Please select a valid JSON backup.");
  }

  if (
    !parsed ||
    parsed.app !== "HisabKhata" ||
    !parsed.business ||
    !parsed.business.id
  ) {
    throw new Error("This file is not a valid HisabKhata backup.");
  }

  const biz = parsed.business;
  const customers: any[] = Array.isArray(parsed.customers)
    ? parsed.customers
    : [];
  const customerEntries: any[] = Array.isArray(parsed.customerEntries)
    ? parsed.customerEntries
    : [];
  const cashbookEntries: any[] = Array.isArray(parsed.cashbookEntries)
    ? parsed.cashbookEntries
    : [];

  const currency: "BDT" | "INR" = biz.currency === "INR" ? "INR" : "BDT";
  const now = Date.now();

  // 1. Upsert Business record
  await db.runAsync(
    `INSERT OR REPLACE INTO businesses (
       id, name, currency, is_synced, is_deleted, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      biz.id,
      biz.name || "Restored Business",
      currency,
      1,
      0,
      biz.created_at ?? now,
      now,
    ],
  );

  // 2. Upsert Customers (Preserves all existing schema columns dynamically)
  for (const c of customers) {
    if (!c.id) continue;
    const customerName = String(c.name || "Customer").trim();
    const fallbackInitials =
      customerName
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "C";

    // Build dynamic insert from the exported customer object keys so no balance column is lost
    const record: Record<string, any> = {
      ...c,
      id: c.id,
      business_id: biz.id,
      name: customerName,
      phone: c.phone ?? null,
      avatar_initials: c.avatar_initials || fallbackInitials,
      is_synced: 1,
      is_deleted: c.is_deleted ?? 0,
      created_at: c.created_at ?? now,
      updated_at: now,
    };

    const keys = Object.keys(record);
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((k) => record[k]);

    await db.runAsync(
      `INSERT OR REPLACE INTO customers (${keys.join(", ")}) VALUES (${placeholders});`,
      values,
    );
  }

  // 3. Upsert Customer Ledger Entries
  for (const ce of customerEntries) {
    if (!ce.id || !ce.customer_id) continue;
    const entryRecord: Record<string, any> = {
      ...ce,
      id: ce.id,
      business_id: biz.id,
      customer_id: ce.customer_id,
      type: ce.type === "GOT" ? "GOT" : "GAVE",
      amount: Number(ce.amount) || 0,
      details: ce.details ?? null,
      entry_date: ce.entry_date,
      entry_time: ce.entry_time,
      timestamp: ce.timestamp ?? now,
      is_synced: 1,
      is_deleted: ce.is_deleted ?? 0,
      created_at: ce.created_at ?? now,
      updated_at: now,
    };

    const keys = Object.keys(entryRecord);
    const placeholders = keys.map(() => "?").join(", ");
    const values = keys.map((k) => entryRecord[k]);

    await db.runAsync(
      `INSERT OR REPLACE INTO customer_entries (${keys.join(", ")}) VALUES (${placeholders});`,
      values,
    );
  }

  // 4. Upsert Cashbook Entries
  for (const cb of cashbookEntries) {
    if (!cb.id) continue;
    await db.runAsync(
      `INSERT OR REPLACE INTO cashbook_entries (
         id, business_id, type, payment_mode, amount, details, entry_date, entry_time, timestamp, is_synced, is_deleted, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        cb.id,
        biz.id,
        cb.type === "IN" ? "IN" : "OUT",
        cb.payment_mode === "ONLINE" ? "ONLINE" : "CASH",
        Number(cb.amount) || 0,
        cb.details ?? null,
        cb.entry_date,
        cb.entry_time,
        cb.timestamp ?? now,
        1,
        cb.is_deleted ?? 0,
        cb.created_at ?? now,
        now,
      ],
    );
  }

  return {
    restored: true,
    businessId: biz.id,
    businessName: biz.name || "Restored Business",
    currency,
    customersCount: customers.length,
    entriesCount: customerEntries.length + cashbookEntries.length,
  };
}

/**
 * Marks all records for the given business as synced (is_synced = 1).
 */
export async function markAllBusinessRecordsSynced(
  db: DatabaseAdapter,
  businessId: string,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE businesses SET is_synced = 1 WHERE id = ? AND is_synced = 0;`,
      [businessId],
    );
    await db.runAsync(
      `UPDATE customers SET is_synced = 1 WHERE business_id = ? AND is_synced = 0;`,
      [businessId],
    );
    await db.runAsync(
      `UPDATE customer_entries SET is_synced = 1 WHERE business_id = ? AND is_synced = 0;`,
      [businessId],
    );
    await db.runAsync(
      `UPDATE cashbook_entries SET is_synced = 1 WHERE business_id = ? AND is_synced = 0;`,
      [businessId],
    );
  });
}
