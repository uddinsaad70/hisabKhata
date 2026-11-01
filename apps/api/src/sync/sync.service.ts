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
