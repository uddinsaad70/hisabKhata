// apps/mobile/utils/backupService.ts
import * as FileSystem from "expo-file-system/legacy";
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
 * Queries SQLite for total active records and unsynced record counts for the active business.
 */
export async function getBusinessBackupStats(
  db: DatabaseAdapter,
  businessId: string,
): Promise<BackupStats> {
  const custRow = await db.getFirstAsync<{ cnt: number; unsynced: number }>(
    `SELECT
       COUNT(CASE WHEN is_deleted = 0 THEN 1 END) AS cnt,
       COUNT(CASE WHEN is_synced = 0 THEN 1 END) AS unsynced
     FROM customers
     WHERE business_id = ?;`,
    [businessId],
  );

  const ceRow = await db.getFirstAsync<{ cnt: number; unsynced: number }>(
    `SELECT
       COUNT(CASE WHEN is_deleted = 0 THEN 1 END) AS cnt,
       COUNT(CASE WHEN is_synced = 0 THEN 1 END) AS unsynced
     FROM customer_entries
     WHERE business_id = ?;`,
    [businessId],
  );

  const cbRow = await db.getFirstAsync<{ cnt: number; unsynced: number }>(
    `SELECT
       COUNT(CASE WHEN is_deleted = 0 THEN 1 END) AS cnt,
       COUNT(CASE WHEN is_synced = 0 THEN 1 END) AS unsynced
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
}
