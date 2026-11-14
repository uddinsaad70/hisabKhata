// apps/mobile/db/syncService.ts
import { DeviceEventEmitter, Platform } from "react-native";
import { type DatabaseAdapter } from "./adapter";
import { getDbAdapter } from "./client";
import {
  getOrInitDeviceSyncState,
  claimLocalBusinessesForUser,
  getAllBusinesses,
  createBusiness,
  type BusinessRow,
} from "./businessQueries";
import {
  recomputeBalance,
  type CustomerRow,
  type CustomerEntryRow,
} from "./customerQueries";
import { type CashbookEntryRow } from "./cashbookQueries";
import { generateId } from "../utils/uuid";
import { roundMoney } from "../utils/formatCurrency";
import {
  clearPendingLogoutSyncSession,
  getApiBaseUrl,
  getCurrentUserProfile,
  getOrCreateDeviceId,
  getPendingLogoutSyncSession,
  getValidAccessToken,
  refreshSessionTokens,
  updateActiveUserProfile,
} from "../utils/userAuthService";
import { useUiStore } from "../store/uiStore";

export interface SyncPushChangesPayload {
  businesses: {
    id: string;
    name: string;
    currency: "BDT" | "INR";
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
  }[];
  customers: {
    id: string;
    businessId: string;
    name: string;
    phone: string | null;
    avatarInitials: string;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
  }[];
  customerEntries: {
    id: string;
    businessId: string;
    customerId: string;
    type: "GAVE" | "GOT";
    amount: string;
    details: string | null;
    entryDate: string;
    entryTime: string;
    timestamp: number;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
  }[];
  cashbookEntries: {
    id: string;
    businessId: string;
    type: "IN" | "OUT";
    paymentMode: "CASH" | "ONLINE";
    amount: string;
    details: string | null;
    entryDate: string;
    entryTime: string;
    timestamp: number;
    createdAt: number;
    updatedAt: number;
    isDeleted: boolean;
  }[];
}

export interface SyncPushRequest {
  deviceId: string;
  changes: SyncPushChangesPayload;
}

export interface SyncPushResponse {
  accepted: {
    businesses: string[];
    customers: string[];
    customerEntries: string[];
    cashbookEntries: string[];
  };
  rejectedConflicts: {
    businesses: SyncPushChangesPayload["businesses"];
    customers: SyncPushChangesPayload["customers"];
    customerEntries: SyncPushChangesPayload["customerEntries"];
    cashbookEntries: SyncPushChangesPayload["cashbookEntries"];
  };
  serverTime: string;
}

export interface SyncPullResponse {
  changes: SyncPushChangesPayload;
  nextCursor: string | null;
  hasMore: boolean;
}

export class CursorExpiredError extends Error {
  public readonly code = "CURSOR_EXPIRED_FULL_RESYNC_REQUIRED";
  constructor() {
    super("Sync cursor expired (410 Gone). Full resync required.");
    this.name = "CursorExpiredError";
  }
}

export interface SyncTransport {
  push(
    payload: SyncPushRequest,
    idempotencyKey: string,
  ): Promise<SyncPushResponse>;
  pull(
    deviceId: string,
    cursor: string | null,
    limit: number,
  ): Promise<SyncPullResponse>;
}

async function authorizedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  let token = await getValidAccessToken();
  if (!token) {
    throw new Error("NOT_AUTHENTICATED: Please sign in to sync.");
  }

  const doRequest = async (bearer: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Bypass-Tunnel-Reminder": "true",
          Authorization: `Bearer ${bearer}`,
          ...(options.headers || {}),
        },
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let res = await doRequest(token);
  if (res.status === 401) {
    const refreshed = await refreshSessionTokens();
    if (!refreshed) {
      throw new Error("SESSION_EXPIRED: Please sign in again.");
    }
    res = await doRequest(refreshed);
  }

  return res;
}

export function createHttpSyncTransport(
  baseUrl: string = getApiBaseUrl(),
): SyncTransport {
  return {
    async push(
      payload: SyncPushRequest,
      idempotencyKey: string,
    ): Promise<SyncPushResponse> {
      const res = await authorizedFetch(`${baseUrl}/sync/push`, {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Sync push failed (${res.status})`);
      }
      return data as SyncPushResponse;
    },

    async pull(
      deviceId: string,
      cursor: string | null,
      limit: number,
    ): Promise<SyncPullResponse> {
      const params = new URLSearchParams({
        deviceId,
        limit: String(limit),
      });
      if (cursor) {
        params.set("cursor", cursor);
      }

      const res = await authorizedFetch(
        `${baseUrl}/sync/pull?${params.toString()}`,
        {
          method: "GET",
        },
      );

      if (res.status === 410) {
        throw new CursorExpiredError();
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Sync pull failed (${res.status})`);
      }
      return data as SyncPullResponse;
    },
  };
}

const MAX_BATCH_SIZE = 200;

/**
 * Collects up to 200 unsynced rows (is_synced = 0) in strict Foreign Key order:
 * 1. businesses -> 2. customers -> 3. customer_entries -> 4. cashbook_entries
 */
export async function collectUnsyncedBatch(
  db: DatabaseAdapter,
  maxRows: number = MAX_BATCH_SIZE,
  ownerUserId: string | null = null,
): Promise<{ payload: SyncPushChangesPayload; totalRows: number }> {
  let remaining = maxRows;

  const payload: SyncPushChangesPayload = {
    businesses: [],
    customers: [],
    customerEntries: [],
    cashbookEntries: [],
  };

  if (remaining > 0) {
    const bizRows = ownerUserId
      ? await db.getAllAsync<BusinessRow>(
          `SELECT * FROM businesses WHERE is_synced = 0 AND owner_user_id = ? ORDER BY created_at ASC LIMIT ?;`,
          [ownerUserId, remaining],
        )
      : await db.getAllAsync<BusinessRow>(
          `SELECT * FROM businesses WHERE is_synced = 0 ORDER BY created_at ASC LIMIT ?;`,
          [remaining],
        );
    for (const b of bizRows) {
      payload.businesses.push({
        id: b.id,
        name: b.name,
        currency: b.currency,
        createdAt: b.created_at,
        updatedAt: b.updated_at,
        isDeleted: b.is_deleted === 1,
      });
    }
    remaining -= bizRows.length;
  }

  if (remaining > 0) {
    const custRows = ownerUserId
      ? await db.getAllAsync<CustomerRow>(
          `SELECT * FROM customers WHERE is_synced = 0 AND business_id IN (SELECT id FROM businesses WHERE owner_user_id = ?) ORDER BY created_at ASC LIMIT ?;`,
          [ownerUserId, remaining],
        )
      : await db.getAllAsync<CustomerRow>(
          `SELECT * FROM customers WHERE is_synced = 0 ORDER BY created_at ASC LIMIT ?;`,
          [remaining],
        );
    for (const c of custRows) {
      payload.customers.push({
        id: c.id,
        businessId: c.business_id,
        name: c.name,
        phone: c.phone,
        avatarInitials: c.avatar_initials,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        isDeleted: c.is_deleted === 1,
      });
    }
    remaining -= custRows.length;
  }

  if (remaining > 0) {
    const ceRows = ownerUserId
      ? await db.getAllAsync<CustomerEntryRow>(
          `SELECT * FROM customer_entries WHERE is_synced = 0 AND business_id IN (SELECT id FROM businesses WHERE owner_user_id = ?) ORDER BY created_at ASC LIMIT ?;`,
          [ownerUserId, remaining],
        )
      : await db.getAllAsync<CustomerEntryRow>(
          `SELECT * FROM customer_entries WHERE is_synced = 0 ORDER BY created_at ASC LIMIT ?;`,
          [remaining],
        );
    for (const ce of ceRows) {
      payload.customerEntries.push({
        id: ce.id,
        businessId: ce.business_id,
        customerId: ce.customer_id,
        type: ce.type,
        amount: roundMoney(ce.amount).toFixed(2),
        details: ce.details,
        entryDate: ce.entry_date,
        entryTime: ce.entry_time,
        timestamp: ce.timestamp,
        createdAt: ce.created_at,
        updatedAt: ce.updated_at,
        isDeleted: ce.is_deleted === 1,
      });
    }
    remaining -= ceRows.length;
  }

  if (remaining > 0) {
    const cbRows = ownerUserId
      ? await db.getAllAsync<CashbookEntryRow>(
          `SELECT * FROM cashbook_entries WHERE is_synced = 0 AND business_id IN (SELECT id FROM businesses WHERE owner_user_id = ?) ORDER BY created_at ASC LIMIT ?;`,
          [ownerUserId, remaining],
        )
      : await db.getAllAsync<CashbookEntryRow>(
          `SELECT * FROM cashbook_entries WHERE is_synced = 0 ORDER BY created_at ASC LIMIT ?;`,
          [remaining],
        );
    for (const cb of cbRows) {
      payload.cashbookEntries.push({
        id: cb.id,
        businessId: cb.business_id,
        type: cb.type,
        paymentMode: cb.payment_mode,
        amount: roundMoney(cb.amount).toFixed(2),
        details: cb.details,
        entryDate: cb.entry_date,
        entryTime: cb.entry_time,
        timestamp: cb.timestamp,
        createdAt: cb.created_at,
        updatedAt: cb.updated_at,
        isDeleted: cb.is_deleted === 1,
      });
    }
    remaining -= cbRows.length;
  }

  const totalRows =
    payload.businesses.length +
    payload.customers.length +
    payload.customerEntries.length +
    payload.cashbookEntries.length;

  return { payload, totalRows };
}

/**
 * Applies remote rows (from either rejectedConflicts or GET /sync/pull) into local SQLite
 * with is_synced = 1 and recomputes affected customer balances.
 */
export async function applyRemoteChangesToLocalDb(
  db: DatabaseAdapter,
  changes: SyncPushChangesPayload,
  ownerUserId: string | null = null,
): Promise<void> {
  const affectedCustomers = new Map<string, string>();

  await db.withTransactionAsync(async () => {
    for (const b of changes.businesses) {
      await db.runAsync(
        `INSERT INTO businesses (id, owner_user_id, name, currency, created_at, updated_at, is_deleted, is_synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           owner_user_id = COALESCE(excluded.owner_user_id, businesses.owner_user_id),
           name = excluded.name,
           currency = excluded.currency,
           updated_at = excluded.updated_at,
           is_deleted = excluded.is_deleted,
           is_synced = 1;`,
        [
          b.id,
          ownerUserId,
          b.name,
          b.currency,
          b.createdAt,
          b.updatedAt,
          b.isDeleted ? 1 : 0,
        ],
      );
    }

    for (const c of changes.customers) {
      await db.runAsync(
        `INSERT INTO customers (id, business_id, name, phone, avatar_initials, net_balance, last_transaction_at, created_at, updated_at, is_deleted, is_synced)
         VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           business_id = excluded.business_id,
           name = excluded.name,
           phone = excluded.phone,
           avatar_initials = excluded.avatar_initials,
           updated_at = excluded.updated_at,
           is_deleted = excluded.is_deleted,
           is_synced = 1;`,
        [
          c.id,
          c.businessId,
          c.name,
          c.phone ?? null,
          c.avatarInitials,
          c.createdAt,
          c.updatedAt,
          c.isDeleted ? 1 : 0,
        ],
      );
      affectedCustomers.set(c.id, c.businessId);
    }

    for (const ce of changes.customerEntries) {
      const numericAmount = roundMoney(Number(ce.amount));
      await db.runAsync(
        `INSERT INTO customer_entries (id, business_id, customer_id, type, amount, details, entry_date, entry_time, timestamp, created_at, updated_at, is_deleted, is_synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           type = excluded.type,
           amount = excluded.amount,
           details = excluded.details,
           entry_date = excluded.entry_date,
           entry_time = excluded.entry_time,
           timestamp = excluded.timestamp,
           updated_at = excluded.updated_at,
           is_deleted = excluded.is_deleted,
           is_synced = 1;`,
        [
          ce.id,
          ce.businessId,
          ce.customerId,
          ce.type,
          numericAmount,
          ce.details ?? null,
          ce.entryDate,
          ce.entryTime,
          ce.timestamp,
          ce.createdAt,
          ce.updatedAt,
          ce.isDeleted ? 1 : 0,
        ],
      );
      affectedCustomers.set(ce.customerId, ce.businessId);
    }

    for (const cb of changes.cashbookEntries) {
      const numericAmount = roundMoney(Number(cb.amount));
      await db.runAsync(
        `INSERT INTO cashbook_entries (id, business_id, type, payment_mode, amount, details, entry_date, entry_time, timestamp, created_at, updated_at, is_deleted, is_synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           type = excluded.type,
           payment_mode = excluded.payment_mode,
           amount = excluded.amount,
           details = excluded.details,
           entry_date = excluded.entry_date,
           entry_time = excluded.entry_time,
           timestamp = excluded.timestamp,
           updated_at = excluded.updated_at,
           is_deleted = excluded.is_deleted,
           is_synced = 1;`,
        [
          cb.id,
          cb.businessId,
          cb.type,
          cb.paymentMode,
          numericAmount,
          cb.details ?? null,
          cb.entryDate,
          cb.entryTime,
          cb.timestamp,
          cb.createdAt,
          cb.updatedAt,
          cb.isDeleted ? 1 : 0,
        ],
      );
    }

    for (const [custId, bizId] of affectedCustomers.entries()) {
      await recomputeBalance(db, bizId, custId);
    }
  });
}

async function markAcceptedIdsAsSynced(
  db: DatabaseAdapter,
  accepted: SyncPushResponse["accepted"],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const id of accepted.businesses) {
      await db.runAsync(`UPDATE businesses SET is_synced = 1 WHERE id = ?;`, [
        id,
      ]);
    }
    for (const id of accepted.customers) {
      await db.runAsync(`UPDATE customers SET is_synced = 1 WHERE id = ?;`, [
        id,
      ]);
    }
    for (const id of accepted.customerEntries) {
      await db.runAsync(
        `UPDATE customer_entries SET is_synced = 1 WHERE id = ?;`,
        [id],
      );
    }
    for (const id of accepted.cashbookEntries) {
      await db.runAsync(
        `UPDATE cashbook_entries SET is_synced = 1 WHERE id = ?;`,
        [id],
      );
    }
  });
}

export interface FullSyncSummary {
  pushedCount: number;
  pulledCount: number;
  conflictsResolved: number;
  resyncedFromScratch: boolean;
}

export async function runFullSyncCycle(
  db: DatabaseAdapter,
  transport: SyncTransport = createHttpSyncTransport(),
  ownerUserId: string | null = null,
): Promise<FullSyncSummary> {
  const syncState = await getOrInitDeviceSyncState(db);
  const deviceId = syncState.device_id;

  let pushedCount = 0;
  let pulledCount = 0;
  let conflictsResolved = 0;
  let resyncedFromScratch = false;

// 1. Push Phase
  while (true) {
    const { payload, totalRows } = await collectUnsyncedBatch(
      db,
      MAX_BATCH_SIZE,
      ownerUserId,
    );
    if (totalRows === 0) {
      break;
    }

    const idempotencyKey = generateId();
    const pushRes = await transport.push(
      { deviceId, changes: payload },
      idempotencyKey,
    );

    await markAcceptedIdsAsSynced(db, pushRes.accepted);
    pushedCount +=
      pushRes.accepted.businesses.length +
      pushRes.accepted.customers.length +
      pushRes.accepted.customerEntries.length +
      pushRes.accepted.cashbookEntries.length;

    const conflictTotal =
      pushRes.rejectedConflicts.businesses.length +
      pushRes.rejectedConflicts.customers.length +
      pushRes.rejectedConflicts.customerEntries.length +
      pushRes.rejectedConflicts.cashbookEntries.length;

    if (conflictTotal > 0) {
      await applyRemoteChangesToLocalDb(
        db,
        pushRes.rejectedConflicts,
        ownerUserId,
      );
      conflictsResolved += conflictTotal;
    }

    await db.runAsync(
      `UPDATE sync_state SET last_pushed_at = ? WHERE business_id = 'GLOBAL';`,
      [Date.now()],
    );
  }

  // 2. Pull Phase
  const executePaginatedPull = async (startCursor: string | null) => {
    let currentCursor = startCursor;
    while (true) {
      const pullRes = await transport.pull(
        deviceId,
        currentCursor,
        MAX_BATCH_SIZE,
      );

      const batchCount =
        pullRes.changes.businesses.length +
        pullRes.changes.customers.length +
        pullRes.changes.customerEntries.length +
        pullRes.changes.cashbookEntries.length;

      if (batchCount > 0) {
        await applyRemoteChangesToLocalDb(db, pullRes.changes, ownerUserId);
        pulledCount += batchCount;
      }

      if (pullRes.nextCursor) {
        currentCursor = pullRes.nextCursor;
        await db.runAsync(
          `UPDATE sync_state SET last_pulled_cursor = ? WHERE business_id = 'GLOBAL';`,
          [currentCursor],
        );
      }

      if (!pullRes.hasMore) {
        break;
      }
    }
  };

  try {
    await executePaginatedPull(syncState.last_pulled_cursor);
  } catch (err) {
    if (err instanceof CursorExpiredError) {
      resyncedFromScratch = true;
      await db.withTransactionAsync(async () => {
        await db.runAsync(`DELETE FROM cashbook_entries WHERE is_synced = 1;`);
        await db.runAsync(`DELETE FROM customer_entries WHERE is_synced = 1;`);
        await db.runAsync(`DELETE FROM customers WHERE is_synced = 1;`);
        await db.runAsync(`DELETE FROM businesses WHERE is_synced = 1;`);
        await db.runAsync(
          `UPDATE sync_state SET last_pulled_cursor = NULL WHERE business_id = 'GLOBAL';`,
        );
      });
      await executePaginatedPull(null);
    } else {
      throw err;
    }
  }

  return {
    pushedCount,
    pulledCount,
    conflictsResolved,
    resyncedFromScratch,
  };
}

let activeSyncPromise: Promise<FullSyncSummary | null> | null = null;

/**
 * High-level helper used by UI screens and background triggers to sync the logged-in user's data.
 * Prevents concurrent overlapping sync runs, isolates multi-user accounts, and heals missing parent businesses.
 */
export async function flushPendingLogoutSyncIfNeeded(): Promise<void> {
  if (Platform.OS === "web") return;
  const pending = await getPendingLogoutSyncSession();
  if (!pending) return;

  try {
    const db = getDbAdapter();
    const syncState = await getOrInitDeviceSyncState(db);
    const baseUrl = getApiBaseUrl();
    let bearer = pending.accessToken;

    while (true) {
      const { payload, totalRows } = await collectUnsyncedBatch(
        db,
        MAX_BATCH_SIZE,
        pending.userId,
      );
      if (totalRows === 0) break;

      let res = await fetch(`${baseUrl}/sync/push`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearer}`,
          "Idempotency-Key": generateId(),
        },
        body: JSON.stringify({
          deviceId: syncState.device_id,
          changes: payload,
        }),
      });

      if (res.status === 401) {
        const deviceId = await getOrCreateDeviceId();
        const refRes = await fetch(`${baseUrl}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refreshToken: pending.refreshToken,
            deviceId,
          }),
        });
        if (!refRes.ok) break;
        const refData = await refRes.json();
        bearer = refData.accessToken;
        res = await fetch(`${baseUrl}/sync/push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bearer}`,
            "Idempotency-Key": generateId(),
          },
          body: JSON.stringify({
            deviceId: syncState.device_id,
            changes: payload,
          }),
        });
      }

      if (!res.ok) return;
      const pushRes = (await res.json()) as SyncPushResponse;
      await markAcceptedIdsAsSynced(db, pushRes.accepted);
    }

    const currentUser = await getCurrentUserProfile();
    if (!currentUser || currentUser.id !== pending.userId) {
      await db.runAsync(`DELETE FROM businesses WHERE owner_user_id = ?;`, [
        pending.userId,
      ]);
    }
    await clearPendingLogoutSyncSession();
  } catch {
    // Keep pending session for next online moment
  }
}

export async function syncNowWithCloud(): Promise<FullSyncSummary | null> {
  if (Platform.OS === "web") return null;
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    try {
      await flushPendingLogoutSyncIfNeeded();

      const user = await getCurrentUserProfile();
      const token = await getValidAccessToken();
      if (!user || !token) {
        return null;
      }

      const db = getDbAdapter();
      await claimLocalBusinessesForUser(db, user.id);

      let summary: FullSyncSummary;
      try {
        summary = await runFullSyncCycle(
          db,
          createHttpSyncTransport(),
          user.id,
        );
      } catch (firstErr: any) {
        if (
          typeof firstErr?.message === "string" &&
          firstErr.message.includes("permission to access this business")
        ) {
          await db.runAsync(
            `UPDATE businesses SET is_synced = 0 WHERE owner_user_id = ?;`,
            [user.id],
          );
          await db.runAsync(
            `UPDATE customers SET is_synced = 0 WHERE business_id IN (SELECT id FROM businesses WHERE owner_user_id = ?);`,
            [user.id],
          );
          summary = await runFullSyncCycle(
            db,
            createHttpSyncTransport(),
            user.id,
          );
        } else {
          throw firstErr;
        }
      }

      // If user has businesses after sync, select one; if 0 businesses, clear active business so app routes to /onboarding
      const businesses = await getAllBusinesses(db, user.id);      if (businesses.length === 0) {
        useUiStore.getState().setActiveBusiness(null as any, "", "BDT");
      } else {
        const currentActiveId = useUiStore.getState().activeBusinessId;
        const matched = businesses.find((b) => b.id === currentActiveId);
        const target = matched ?? businesses[0];
        useUiStore
          .getState()
          .setActiveBusiness(target.id, target.name, target.currency);
      }

      const nowDisplay = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      await updateActiveUserProfile({ lastSyncedAt: nowDisplay });

      DeviceEventEmitter.emit("SYNC_COMPLETED");

      return summary;
    } catch (err) {
      console.warn("Background sync skipped:", err);
      return null;
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}
