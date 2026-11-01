// apps/api/src/sync/sync.routes.ts
import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import {
  authMiddleware,
  type AuthenticatedRequest,
} from "../middleware/authMiddleware.js";
import { requireBusinessOwnership } from "../middleware/ownershipMiddleware.js";
import { syncPullQuerySchema, syncPushRequestSchema } from "./sync.schema.js";
import { processPull, processPushBatch, SyncError } from "./sync.service.js";

export const syncRouter = Router();

const syncRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: env.NODE_ENV === "test" ? 300 : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_SYNC_REQUESTS",
    message: "Sync rate limit exceeded, please try again shortly.",
  },
});

syncRouter.use(syncRateLimiter);

function handleSyncRouteError(err: unknown, res: Response): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: err.errors[0]?.message || "Invalid sync request parameters.",
      details: err.errors,
    });
    return;
  }
  if (err instanceof SyncError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
    return;
  }
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "Sync operation failed.",
  });
}

/**
 * POST /sync/push
 * Protected by JWT authMiddleware and business_id ownership check.
 */
syncRouter.post(
  "/push",
  authMiddleware,
  requireBusinessOwnership({ allowNewBusinessesInSyncPush: true }),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const parsed = syncPushRequestSchema.parse(req.body);
      const result = await processPushBatch(userId, parsed);
      res.status(200).json(result);
    } catch (err) {
      handleSyncRouteError(err, res);
    }
  },
);

/**
 * GET /sync/pull?deviceId=...&cursor=...&limit=200
 * Protected by JWT authMiddleware; pulls only businesses owned by req.userId.
 */
syncRouter.get(
  "/pull",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const query = syncPullQuerySchema.parse(req.query);
      const result = await processPull({
        userId,
        deviceId: query.deviceId,
        cursor: query.cursor,
        limit: query.limit,
      });
      res.status(200).json(result);
    } catch (err) {
      handleSyncRouteError(err, res);
    }
  },
);
