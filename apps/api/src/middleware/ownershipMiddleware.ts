// apps/api/src/middleware/ownershipMiddleware.ts
import { type Response, type NextFunction } from "express";
import { prisma } from "../db/prisma.js";
import { type AuthenticatedRequest } from "./authMiddleware.js";

/**
 * Extracts all unique businessIds referenced in a request (body, sync changes payload, query, or params).
 */
export function extractBusinessIdsFromRequest(
  req: AuthenticatedRequest,
): string[] {
  const ids = new Set<string>();

  if (typeof req.body?.businessId === "string" && req.body.businessId.trim()) {
    ids.add(req.body.businessId.trim());
  }
  if (
    typeof req.query?.businessId === "string" &&
    req.query.businessId.trim()
  ) {
    ids.add(req.query.businessId.trim());
  }
  if (
    typeof req.params?.businessId === "string" &&
    req.params.businessId.trim()
  ) {
    ids.add(req.params.businessId.trim());
  }

  // Also inspect batch sync payload (req.body.changes) if present
  const changes = req.body?.changes;
  if (changes && typeof changes === "object") {
    if (Array.isArray(changes.businesses)) {
      for (const b of changes.businesses) {
        if (typeof b?.id === "string") ids.add(b.id);
      }
    }
    if (Array.isArray(changes.customers)) {
      for (const c of changes.customers) {
        if (typeof c?.businessId === "string") ids.add(c.businessId);
      }
    }
    if (Array.isArray(changes.customerEntries)) {
      for (const ce of changes.customerEntries) {
        if (typeof ce?.businessId === "string") ids.add(ce.businessId);
      }
    }
    if (Array.isArray(changes.cashbookEntries)) {
      for (const cb of changes.cashbookEntries) {
        if (typeof cb?.businessId === "string") ids.add(cb.businessId);
      }
    }
  }

  return Array.from(ids);
}

/**
 * Middleware that verifies every businessId in the request belongs to req.userId.
 * Note: For new businesses being created in POST /sync/push (changes.businesses),
 * if a businessId does not exist in DB yet AND is included in changes.businesses,
 * it is allowed to be created under req.userId. If it exists in DB and belongs to
 * another user, 403 Forbidden is returned immediately.
 */
export function requireBusinessOwnership(options?: {
  allowNewBusinessesInSyncPush?: boolean;
}) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({
          error: "UNAUTHORIZED",
          message: "User context not found.",
        });
        return;
      }

      const businessIds = extractBusinessIdsFromRequest(req);
      if (businessIds.length === 0) {
        if (options?.allowNewBusinessesInSyncPush) {
          next();
          return;
        }
        res.status(400).json({
          error: "MISSING_BUSINESS_ID",
          message: "Business ID is required in the request.",
        });
        return;
      }

      // Equivalent Raw SQL:
      // SELECT id, owner_user_id FROM businesses WHERE id = ANY($1::uuid[]);
      const existingBusinesses = await prisma.business.findMany({
        where: {
          id: { in: businessIds },
        },
        select: {
          id: true,
          ownerUserId: true,
        },
      });

      const existingMap = new Map(
        existingBusinesses.map((b) => [b.id, b.ownerUserId]),
      );

      // IDs being pushed as new businesses in this same batch
      const pushedBusinessIds = new Set<string>(
        Array.isArray(req.body?.changes?.businesses)
          ? req.body.changes.businesses
              .map((b: { id?: string }) => b?.id)
              .filter((id: unknown): id is string => typeof id === "string")
          : [],
      );

      for (const bizId of businessIds) {
        const ownerId = existingMap.get(bizId);
        if (!ownerId) {
          // Business does not exist in DB yet
          if (
            options?.allowNewBusinessesInSyncPush &&
            pushedBusinessIds.has(bizId)
          ) {
            continue;
          }
          res.status(403).json({
            error: "FORBIDDEN",
            message: "You do not have permission to access this business.",
          });
          return;
        }

        if (ownerId !== userId) {
          res.status(403).json({
            error: "FORBIDDEN",
            message: "You do not have permission to access this business.",
          });
          return;
        }
      }

      next();
    } catch (err) {
      res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "Authorization error",
      });
    }
  };
}
