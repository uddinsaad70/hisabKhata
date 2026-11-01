// apps/api/src/sync/sync.service.ts
import { prisma } from "../db/prisma.js";
import type { SyncPushRequestInput } from "./sync.schema.js";

const MAX_CLOCK_DRIFT_MS = 5 * 60 * 1000; // 5 minutes

export class SyncError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Clamps a client timestamp so a phone with its clock set in the future
 * (> serverNow + 5 minutes) cannot permanently lock out future LWW updates.
 */
export function clampClientTimestamp(
  clientTimestampMs: number,
  serverNowMs: number = Date.now(),
): bigint {
  if (clientTimestampMs > serverNowMs + MAX_CLOCK_DRIFT_MS) {
    return BigInt(serverNowMs);
  }
  return BigInt(clientTimestampMs);
}

export interface SyncPushResult {
  accepted: {
    businesses: string[];
    customers: string[];
    customerEntries: string[];
    cashbookEntries: string[];
  };
  rejectedConflicts: {
    businesses: unknown[];
    customers: unknown[];
    customerEntries: unknown[];
    cashbookEntries: unknown[];
  };
  serverTime: string;
}

/**
 * Processes a batch of up to 200 rows in strict Foreign Key order inside a single transaction:
 * 1. businesses -> 2. customers -> 3. customer_entries -> 4. cashbook_entries
 */
export async function processPushBatch(
  userId: string,
  payload: SyncPushRequestInput,
): Promise<SyncPushResult> {
  const serverNowMs = Date.now();

  const accepted: SyncPushResult["accepted"] = {
    businesses: [],
    customers: [],
    customerEntries: [],
    cashbookEntries: [],
  };

  const rejectedConflicts: SyncPushResult["rejectedConflicts"] = {
    businesses: [],
    customers: [],
    customerEntries: [],
    cashbookEntries: [],
  };

  await prisma.$transaction(
    async (tx) => {
      // Update device last_seen_at
      await tx.device.upsert({
        where: { deviceId: payload.deviceId },
        update: { userId, lastSeenAt: new Date() },
        create: {
          deviceId: payload.deviceId,
          userId,
          lastSeenAt: new Date(),
        },
      });

      // =========================================================================
      // 1. BUSINESSES (Root FK Table)
      // Equivalent Raw SQL for conditional LWW Upsert:
      // INSERT INTO businesses (id, owner_user_id, name, currency, is_deleted, created_at, updated_at)
      // VALUES ($1, $2, $3, $4, $5, $6, $7)
      // ON CONFLICT (id) DO UPDATE
      // SET name = EXCLUDED.name,
      //     currency = EXCLUDED.currency,
      //     is_deleted = EXCLUDED.is_deleted,
      //     updated_at = EXCLUDED.updated_at
      // WHERE businesses.owner_user_id = EXCLUDED.owner_user_id
      //   AND EXCLUDED.updated_at >= businesses.updated_at;
      // =========================================================================
      if (payload.changes.businesses.length > 0) {
        const bizIds = payload.changes.businesses.map((b) => b.id);
        const existingBizList = await tx.business.findMany({
          where: { id: { in: bizIds } },
        });
        const existingBizMap = new Map(existingBizList.map((b) => [b.id, b]));

        for (const biz of payload.changes.businesses) {
          const clampedUpdatedAt = clampClientTimestamp(
            biz.updatedAt,
            serverNowMs,
          );
          const clampedCreatedAt = clampClientTimestamp(
            biz.createdAt,
            serverNowMs,
          );

          const existing = existingBizMap.get(biz.id);

          if (!existing) {
            await tx.business.create({
              data: {
                id: biz.id,
                ownerUserId: userId,
                name: biz.name,
                currency: biz.currency,
                isDeleted: biz.isDeleted,
                createdAt: clampedCreatedAt,
                updatedAt: clampedUpdatedAt,
              },
            });
            accepted.businesses.push(biz.id);
          } else if (existing.ownerUserId !== userId) {
            throw new SyncError(
              403,
              "FORBIDDEN",
              "Cannot push business owned by another user.",
            );
          } else if (clampedUpdatedAt >= existing.updatedAt) {
            await tx.business.update({
              where: { id: biz.id },
              data: {
                name: biz.name,
                currency: biz.currency,
                isDeleted: biz.isDeleted,
                updatedAt: clampedUpdatedAt,
              },
            });
            accepted.businesses.push(biz.id);
          } else {
            rejectedConflicts.businesses.push({
              id: existing.id,
              name: existing.name,
              currency: existing.currency,
              createdAt: Number(existing.createdAt),
              updatedAt: Number(existing.updatedAt),
              serverUpdatedAt: existing.serverUpdatedAt.toISOString(),
              isDeleted: existing.isDeleted,
            });
          }
        }
      }

      // =========================================================================
      // 2. CUSTOMERS (Depends on businesses.id)
      // Equivalent Raw SQL for conditional LWW Upsert:
      // INSERT INTO customers (id, business_id, name, phone, avatar_initials, is_deleted, created_at, updated_at)
      // VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      // ON CONFLICT (id) DO UPDATE
      // SET name = EXCLUDED.name,
      //     phone = EXCLUDED.phone,
      //     avatar_initials = EXCLUDED.avatar_initials,
      //     is_deleted = EXCLUDED.is_deleted,
      //     updated_at = EXCLUDED.updated_at
      // WHERE EXCLUDED.updated_at >= customers.updated_at;
      // =========================================================================
      if (payload.changes.customers.length > 0) {
        const custIds = payload.changes.customers.map((c) => c.id);
        const existingCustList = await tx.customer.findMany({
          where: { id: { in: custIds } },
        });
        const existingCustMap = new Map(existingCustList.map((c) => [c.id, c]));

        for (const cust of payload.changes.customers) {
          const clampedUpdatedAt = clampClientTimestamp(
            cust.updatedAt,
            serverNowMs,
          );
          const clampedCreatedAt = clampClientTimestamp(
            cust.createdAt,
            serverNowMs,
          );

          const existing = existingCustMap.get(cust.id);

          if (!existing) {
            await tx.customer.create({
              data: {
                id: cust.id,
                businessId: cust.businessId,
                name: cust.name,
                phone: cust.phone ?? null,
                avatarInitials: cust.avatarInitials,
                isDeleted: cust.isDeleted,
                createdAt: clampedCreatedAt,
                updatedAt: clampedUpdatedAt,
              },
            });
            accepted.customers.push(cust.id);
          } else if (clampedUpdatedAt >= existing.updatedAt) {
            await tx.customer.update({
              where: { id: cust.id },
              data: {
                name: cust.name,
                phone: cust.phone ?? null,
                avatarInitials: cust.avatarInitials,
                isDeleted: cust.isDeleted,
                updatedAt: clampedUpdatedAt,
              },
            });
            accepted.customers.push(cust.id);
          } else {
            rejectedConflicts.customers.push({
              id: existing.id,
              businessId: existing.businessId,
              name: existing.name,
              phone: existing.phone,
              avatarInitials: existing.avatarInitials,
              createdAt: Number(existing.createdAt),
              updatedAt: Number(existing.updatedAt),
              serverUpdatedAt: existing.serverUpdatedAt.toISOString(),
              isDeleted: existing.isDeleted,
            });
          }
        }
      }

      // =========================================================================
      // 3. CUSTOMER ENTRIES (Depends on businesses.id & customers.id)
      // Equivalent Raw SQL for conditional LWW Upsert:
      // INSERT INTO customer_entries (id, business_id, customer_id, type, amount, details, entry_date, entry_time, timestamp, is_deleted, created_at, updated_at)
      // VALUES ($1, $2, $3, $4, $5::numeric(14,2), $6, $7, $8, $9, $10, $11, $12)
      // ON CONFLICT (id) DO UPDATE
      // SET type = EXCLUDED.type,
      //     amount = EXCLUDED.amount,
      //     details = EXCLUDED.details,
      //     entry_date = EXCLUDED.entry_date,
      //     entry_time = EXCLUDED.entry_time,
      //     timestamp = EXCLUDED.timestamp,
      //     is_deleted = EXCLUDED.is_deleted,
      //     updated_at = EXCLUDED.updated_at
      // WHERE EXCLUDED.updated_at >= customer_entries.updated_at;
      // =========================================================================
      if (payload.changes.customerEntries.length > 0) {
        const ceIds = payload.changes.customerEntries.map((ce) => ce.id);
        const existingCeList = await tx.customerEntry.findMany({
          where: { id: { in: ceIds } },
        });
        const existingCeMap = new Map(existingCeList.map((ce) => [ce.id, ce]));

        for (const ce of payload.changes.customerEntries) {
          const clampedUpdatedAt = clampClientTimestamp(
            ce.updatedAt,
            serverNowMs,
          );
          const clampedCreatedAt = clampClientTimestamp(
            ce.createdAt,
            serverNowMs,
          );

          const existing = existingCeMap.get(ce.id);

          if (!existing) {
            await tx.customerEntry.create({
              data: {
                id: ce.id,
                businessId: ce.businessId,
                customerId: ce.customerId,
                type: ce.type,
                amount: ce.amount,
                details: ce.details ?? null,
                entryDate: ce.entryDate,
                entryTime: ce.entryTime,
                timestamp: BigInt(ce.timestamp),
                isDeleted: ce.isDeleted,
                createdAt: clampedCreatedAt,
                updatedAt: clampedUpdatedAt,
              },
            });
            accepted.customerEntries.push(ce.id);
          } else if (clampedUpdatedAt >= existing.updatedAt) {
            await tx.customerEntry.update({
              where: { id: ce.id },
              data: {
                type: ce.type,
                amount: ce.amount,
                details: ce.details ?? null,
                entryDate: ce.entryDate,
                entryTime: ce.entryTime,
                timestamp: BigInt(ce.timestamp),
                isDeleted: ce.isDeleted,
                updatedAt: clampedUpdatedAt,
              },
            });
            accepted.customerEntries.push(ce.id);
          } else {
            rejectedConflicts.customerEntries.push({
              id: existing.id,
              businessId: existing.businessId,
              customerId: existing.customerId,
              type: existing.type,
              amount: existing.amount.toFixed(2),
              details: existing.details,
              entryDate: existing.entryDate,
              entryTime: existing.entryTime,
              timestamp: Number(existing.timestamp),
              createdAt: Number(existing.createdAt),
              updatedAt: Number(existing.updatedAt),
              serverUpdatedAt: existing.serverUpdatedAt.toISOString(),
              isDeleted: existing.isDeleted,
            });
          }
        }
      }

      // =========================================================================
      // 4. CASHBOOK ENTRIES (Depends on businesses.id)
      // Equivalent Raw SQL for conditional LWW Upsert:
      // INSERT INTO cashbook_entries (id, business_id, type, payment_mode, amount, details, entry_date, entry_time, timestamp, is_deleted, created_at, updated_at)
      // VALUES ($1, $2, $3, $4, $5::numeric(14,2), $6, $7, $8, $9, $10, $11, $12)
      // ON CONFLICT (id) DO UPDATE
      // SET type = EXCLUDED.type,
      //     payment_mode = EXCLUDED.payment_mode,
      //     amount = EXCLUDED.amount,
      //     details = EXCLUDED.details,
      //     entry_date = EXCLUDED.entry_date,
      //     entry_time = EXCLUDED.entry_time,
      //     timestamp = EXCLUDED.timestamp,
      //     is_deleted = EXCLUDED.is_deleted,
      //     updated_at = EXCLUDED.updated_at
      // WHERE EXCLUDED.updated_at >= cashbook_entries.updated_at;
      // =========================================================================
      if (payload.changes.cashbookEntries.length > 0) {
        const cbIds = payload.changes.cashbookEntries.map((cb) => cb.id);
        const existingCbList = await tx.cashbookEntry.findMany({
          where: { id: { in: cbIds } },
        });
        const existingCbMap = new Map(existingCbList.map((cb) => [cb.id, cb]));

        for (const cb of payload.changes.cashbookEntries) {
          const clampedUpdatedAt = clampClientTimestamp(
            cb.updatedAt,
            serverNowMs,
          );
          const clampedCreatedAt = clampClientTimestamp(
            cb.createdAt,
            serverNowMs,
          );

          const existing = existingCbMap.get(cb.id);

          if (!existing) {
            await tx.cashbookEntry.create({
              data: {
                id: cb.id,
                businessId: cb.businessId,
                type: cb.type,
                paymentMode: cb.paymentMode,
                amount: cb.amount,
                details: cb.details ?? null,
                entryDate: cb.entryDate,
                entryTime: cb.entryTime,
                timestamp: BigInt(cb.timestamp),
                isDeleted: cb.isDeleted,
                createdAt: clampedCreatedAt,
                updatedAt: clampedUpdatedAt,
              },
            });
            accepted.cashbookEntries.push(cb.id);
          } else if (clampedUpdatedAt >= existing.updatedAt) {
            await tx.cashbookEntry.update({
              where: { id: cb.id },
              data: {
                type: cb.type,
                paymentMode: cb.paymentMode,
                amount: cb.amount,
                details: cb.details ?? null,
                entryDate: cb.entryDate,
                entryTime: cb.entryTime,
                timestamp: BigInt(cb.timestamp),
                isDeleted: cb.isDeleted,
                updatedAt: clampedUpdatedAt,
              },
            });
            accepted.cashbookEntries.push(cb.id);
          } else {
            rejectedConflicts.cashbookEntries.push({
              id: existing.id,
              businessId: existing.businessId,
              type: existing.type,
              paymentMode: existing.paymentMode,
              amount: existing.amount.toFixed(2),
              details: existing.details,
              entryDate: existing.entryDate,
              entryTime: existing.entryTime,
              timestamp: Number(existing.timestamp),
              createdAt: Number(existing.createdAt),
              updatedAt: Number(existing.updatedAt),
              serverUpdatedAt: existing.serverUpdatedAt.toISOString(),
              isDeleted: existing.isDeleted,
            });
          }
        }
      }
    },
    {
      maxWait: 15000,
      timeout: 30000,
    },
  );

  return {
    accepted,
    rejectedConflicts,
    serverTime: new Date().toISOString(),
  };
}

// ============================================================================
// CP24: Paginated Pull (GET /sync/pull), Multi-Table Cursor, 410 Gone & Purge
// ============================================================================

const CURSOR_RETENTION_DAYS = 90;
const CURSOR_RETENTION_MS = CURSOR_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export interface TableCursorPoint {
  ts: string; // ISO timestamp of server_updated_at
  id: string; // UUID tie-breaker
}

export interface MultiTablePullCursor {
  businesses?: TableCursorPoint;
  customers?: TableCursorPoint;
  customerEntries?: TableCursorPoint;
  cashbookEntries?: TableCursorPoint;
}

/**
 * Encodes a multi-table cursor state into a compact URL-safe token.
 * Also keeps the earliest timestamp prefix so simple timestamp inspection works.
 */
export function encodePullCursor(state: MultiTablePullCursor): string {
  const json = JSON.stringify(state);
  return Buffer.from(json, "utf8").toString("base64url");
}

/**
 * Decodes either a Base64URL multi-table cursor JSON or a legacy "<iso>_<uuid>" string.
 */
export function decodePullCursor(rawCursor?: string): MultiTablePullCursor {
  if (!rawCursor || !rawCursor.trim()) {
    return {};
  }

  const trimmed = rawCursor.trim();

  // Support legacy format: "2026-10-18T18:00:00.000Z_0192a8b3-..."
  const underscoreIdx = trimmed.indexOf("_");
  if (underscoreIdx > 10 && trimmed.includes("T") && trimmed.includes("-")) {
    const ts = trimmed.slice(0, underscoreIdx);
    const id = trimmed.slice(underscoreIdx + 1);
    const parsedDate = new Date(ts);
    if (!Number.isNaN(parsedDate.getTime()) && id.length >= 32) {
      const point: TableCursorPoint = { ts: parsedDate.toISOString(), id };
      return {
        businesses: point,
        customers: point,
        customerEntries: point,
        cashbookEntries: point,
      };
    }
  }

  try {
    const decodedJson = Buffer.from(trimmed, "base64url").toString("utf8");
    const parsed = JSON.parse(decodedJson) as MultiTablePullCursor;
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    throw new SyncError(
      400,
      "INVALID_CURSOR",
      "The provided sync pull cursor is malformed.",
    );
  }

  throw new SyncError(
    400,
    "INVALID_CURSOR",
    "The provided sync pull cursor is invalid.",
  );
}

/**
 * Validates that no table cursor timestamp is older than the 90-day retention window.
 * Throws HTTP 410 Gone if expired.
 */
function assertCursorNotExpired(cursorState: MultiTablePullCursor): void {
  const cutoffMs = Date.now() - CURSOR_RETENTION_MS;
  const points = [
    cursorState.businesses,
    cursorState.customers,
    cursorState.customerEntries,
    cursorState.cashbookEntries,
  ].filter((p): p is TableCursorPoint => Boolean(p));

  for (const pt of points) {
    const tsMs = new Date(pt.ts).getTime();
    if (Number.isNaN(tsMs)) {
      throw new SyncError(
        400,
        "INVALID_CURSOR",
        "Cursor contains an invalid timestamp.",
      );
    }
    if (tsMs < cutoffMs) {
      throw new SyncError(
        410,
        "CURSOR_EXPIRED_FULL_RESYNC_REQUIRED",
        "Sync cursor is older than 90 days. Please push unsynced data and perform a full resync.",
      );
    }
  }
}

/**
 * Builds the Prisma WHERE clause for tuple comparison:
 * (server_updated_at, id) > (cursor.ts, cursor.id)
 * Handles sub-millisecond Postgres microsecond remainders safely by treating
 * [cursorDate, cursorDate + 1ms) as the same millisecond bucket for tie-breaking on id.
 */
function buildTupleCursorFilter(point?: TableCursorPoint) {
  if (!point) return {};
  const cursorDate = new Date(point.ts);
  const nextMillisecond = new Date(cursorDate.getTime() + 1);
  return {
    OR: [
      { serverUpdatedAt: { gte: nextMillisecond } },
      {
        serverUpdatedAt: {
          gte: cursorDate,
          lt: nextMillisecond,
        },
        id: { gt: point.id },
      },
    ],
  };
}

export interface SyncPullResult {
  changes: {
    businesses: unknown[];
    customers: unknown[];
    customerEntries: unknown[];
    cashbookEntries: unknown[];
  };
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Paginated Pull across all 4 tables in strict Foreign Key order:
 * 1. businesses -> 2. customers -> 3. customer_entries -> 4. cashbook_entries
 */
export async function processPull(params: {
  userId: string;
  deviceId: string;
  cursor?: string;
  limit: number;
}): Promise<SyncPullResult> {
  const { userId, deviceId, cursor, limit } = params;

  const cursorState = decodePullCursor(cursor);
  assertCursorNotExpired(cursorState);

  const nextCursorState: MultiTablePullCursor = { ...cursorState };
  let remaining = limit;
  let hasMore = false;

  const changes: SyncPullResult["changes"] = {
    businesses: [],
    customers: [],
    customerEntries: [],
    cashbookEntries: [],
  };

  // Fetch all business IDs owned by this user (including soft-deleted ones for sync propagation)
  const userBusinesses = await prisma.business.findMany({
    where: { ownerUserId: userId },
    select: { id: true },
  });
  const ownedBusinessIds = userBusinesses.map((b) => b.id);

  // ===========================================================================
  // 1. Pull BUSINESSES
  // ===========================================================================
  if (remaining > 0) {
    const rows = await prisma.business.findMany({
      where: {
        ownerUserId: userId,
        ...buildTupleCursorFilter(cursorState.businesses),
      },
      orderBy: [{ serverUpdatedAt: "asc" }, { id: "asc" }],
      take: remaining + 1,
    });

    if (rows.length > remaining) {
      hasMore = true;
      rows.pop();
    }

    for (const r of rows) {
      changes.businesses.push({
        id: r.id,
        name: r.name,
        currency: r.currency,
        createdAt: Number(r.createdAt),
        updatedAt: Number(r.updatedAt),
        serverUpdatedAt: r.serverUpdatedAt.toISOString(),
        isDeleted: r.isDeleted,
      });
      nextCursorState.businesses = {
        ts: r.serverUpdatedAt.toISOString(),
        id: r.id,
      };
    }
    remaining -= rows.length;
  }

  // ===========================================================================
  // 2. Pull CUSTOMERS
  // ===========================================================================
  if (!hasMore && ownedBusinessIds.length > 0) {
    if (remaining > 0) {
      const rows = await prisma.customer.findMany({
        where: {
          businessId: { in: ownedBusinessIds },
          ...buildTupleCursorFilter(cursorState.customers),
        },
        orderBy: [{ serverUpdatedAt: "asc" }, { id: "asc" }],
        take: remaining + 1,
      });

      if (rows.length > remaining) {
        hasMore = true;
        rows.pop();
      }

      for (const r of rows) {
        changes.customers.push({
          id: r.id,
          businessId: r.businessId,
          name: r.name,
          phone: r.phone,
          avatarInitials: r.avatarInitials,
          createdAt: Number(r.createdAt),
          updatedAt: Number(r.updatedAt),
          serverUpdatedAt: r.serverUpdatedAt.toISOString(),
          isDeleted: r.isDeleted,
        });
        nextCursorState.customers = {
          ts: r.serverUpdatedAt.toISOString(),
          id: r.id,
        };
      }
      remaining -= rows.length;
    } else {
      const pendingCustomer = await prisma.customer.findFirst({
        where: {
          businessId: { in: ownedBusinessIds },
          ...buildTupleCursorFilter(cursorState.customers),
        },
        select: { id: true },
      });
      if (pendingCustomer) hasMore = true;
    }
  }

  // ===========================================================================
  // 3. Pull CUSTOMER ENTRIES
  // ===========================================================================
  if (!hasMore && ownedBusinessIds.length > 0) {
    if (remaining > 0) {
      const rows = await prisma.customerEntry.findMany({
        where: {
          businessId: { in: ownedBusinessIds },
          ...buildTupleCursorFilter(cursorState.customerEntries),
        },
        orderBy: [{ serverUpdatedAt: "asc" }, { id: "asc" }],
        take: remaining + 1,
      });

      if (rows.length > remaining) {
        hasMore = true;
        rows.pop();
      }

      for (const r of rows) {
        changes.customerEntries.push({
          id: r.id,
          businessId: r.businessId,
          customerId: r.customerId,
          type: r.type,
          amount: r.amount.toFixed(2),
          details: r.details,
          entryDate: r.entryDate,
          entryTime: r.entryTime,
          timestamp: Number(r.timestamp),
          createdAt: Number(r.createdAt),
          updatedAt: Number(r.updatedAt),
          serverUpdatedAt: r.serverUpdatedAt.toISOString(),
          isDeleted: r.isDeleted,
        });
        nextCursorState.customerEntries = {
          ts: r.serverUpdatedAt.toISOString(),
          id: r.id,
        };
      }
      remaining -= rows.length;
    } else {
      const pendingCe = await prisma.customerEntry.findFirst({
        where: {
          businessId: { in: ownedBusinessIds },
          ...buildTupleCursorFilter(cursorState.customerEntries),
        },
        select: { id: true },
      });
      if (pendingCe) hasMore = true;
    }
  }

  // ===========================================================================
  // 4. Pull CASHBOOK ENTRIES
  // ===========================================================================
  if (!hasMore && ownedBusinessIds.length > 0) {
    if (remaining > 0) {
      const rows = await prisma.cashbookEntry.findMany({
        where: {
          businessId: { in: ownedBusinessIds },
          ...buildTupleCursorFilter(cursorState.cashbookEntries),
        },
        orderBy: [{ serverUpdatedAt: "asc" }, { id: "asc" }],
        take: remaining + 1,
      });

      if (rows.length > remaining) {
        hasMore = true;
        rows.pop();
      }

      for (const r of rows) {
        changes.cashbookEntries.push({
          id: r.id,
          businessId: r.businessId,
          type: r.type,
          paymentMode: r.paymentMode,
          amount: r.amount.toFixed(2),
          details: r.details,
          entryDate: r.entryDate,
          entryTime: r.entryTime,
          timestamp: Number(r.timestamp),
          createdAt: Number(r.createdAt),
          updatedAt: Number(r.updatedAt),
          serverUpdatedAt: r.serverUpdatedAt.toISOString(),
          isDeleted: r.isDeleted,
        });
        nextCursorState.cashbookEntries = {
          ts: r.serverUpdatedAt.toISOString(),
          id: r.id,
        };
      }
      remaining -= rows.length;
    } else {
      const pendingCb = await prisma.cashbookEntry.findFirst({
        where: {
          businessId: { in: ownedBusinessIds },
          ...buildTupleCursorFilter(cursorState.cashbookEntries),
        },
        select: { id: true },
      });
      if (pendingCb) hasMore = true;
    }
  }

  const hasAnyCursor =
    Boolean(nextCursorState.businesses) ||
    Boolean(nextCursorState.customers) ||
    Boolean(nextCursorState.customerEntries) ||
    Boolean(nextCursorState.cashbookEntries);

  const encodedNextCursor = hasAnyCursor
    ? encodePullCursor(nextCursorState)
    : null;

  // Use database clock for lastPulledAt so it aligns with Postgres server_updated_at clock
  const dbNowRows = await prisma.$queryRaw<{ now: Date }[]>`
    SELECT clock_timestamp() AS now;
  `;
  const dbNow = dbNowRows[0]?.now ?? new Date();

  await prisma.device.upsert({
    where: { deviceId },
    update: {
      userId,
      lastPulledCursor: encodedNextCursor,
      lastPulledAt: dbNow,
      lastSeenAt: dbNow,
    },
    create: {
      deviceId,
      userId,
      lastPulledCursor: encodedNextCursor,
      lastPulledAt: dbNow,
      lastSeenAt: dbNow,
    },
  });

  return {
    changes,
    nextCursor: encodedNextCursor,
    hasMore,
  };
}

/**
 * Device-Aware Tombstone Purge (Section 7.3.2):
 * Physically deletes soft-deleted rows (is_deleted = true) for a user ONLY when:
 *   1. All active devices of that user have pulled past the row's server_updated_at
 *      (server_updated_at < MIN(devices.last_pulled_at)), OR
 *   2. The tombstone is older than 90 days (retention window).
 */
export async function purgeTombstones(userId: string): Promise<{
  purgedCustomerEntries: number;
  purgedCashbookEntries: number;
  purgedCustomers: number;
  purgedBusinesses: number;
}> {
  const retentionCutoff = new Date(Date.now() - CURSOR_RETENTION_MS);

  const devices = await prisma.device.findMany({
    where: { userId },
    select: { lastPulledAt: true },
  });

  let safeDeviceWatermark: Date | null = null;
  if (devices.length > 0 && devices.every((d) => d.lastPulledAt !== null)) {
    const minMs = Math.min(...devices.map((d) => d.lastPulledAt!.getTime()));
    safeDeviceWatermark = new Date(minMs);
  }

  const purgeCutoff =
    safeDeviceWatermark && safeDeviceWatermark > retentionCutoff
      ? safeDeviceWatermark
      : retentionCutoff;

  const userBusinesses = await prisma.business.findMany({
    where: { ownerUserId: userId },
    select: { id: true },
  });
  const bizIds = userBusinesses.map((b) => b.id);

  if (bizIds.length === 0) {
    return {
      purgedCustomerEntries: 0,
      purgedCashbookEntries: 0,
      purgedCustomers: 0,
      purgedBusinesses: 0,
    };
  }

  const delCe = await prisma.customerEntry.deleteMany({
    where: {
      businessId: { in: bizIds },
      isDeleted: true,
      serverUpdatedAt: { lte: purgeCutoff },
    },
  });

  const delCb = await prisma.cashbookEntry.deleteMany({
    where: {
      businessId: { in: bizIds },
      isDeleted: true,
      serverUpdatedAt: { lte: purgeCutoff },
    },
  });

  const delCust = await prisma.customer.deleteMany({
    where: {
      businessId: { in: bizIds },
      isDeleted: true,
      serverUpdatedAt: { lte: purgeCutoff },
    },
  });

  const delBiz = await prisma.business.deleteMany({
    where: {
      ownerUserId: userId,
      isDeleted: true,
      serverUpdatedAt: { lte: purgeCutoff },
    },
  });

  return {
    purgedCustomerEntries: delCe.count,
    purgedCashbookEntries: delCb.count,
    purgedCustomers: delCust.count,
    purgedBusinesses: delBiz.count,
  };
}
