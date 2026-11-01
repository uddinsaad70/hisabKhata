// apps/api/src/app.ts
import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { sanitizeBigIntForJson } from "./utils/bigintSerializer.js";
import { authRouter } from "./auth/auth.routes.js";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.body.password",
      "req.body.refreshToken",
      "req.body.idToken",
    ],
    censor: "[REDACTED]",
  },
});

export function createApp(): Express {
  const app = express();

  // 1. Security & CORS headers
  app.use(helmet());
  app.use(cors());

  // 2. JSON body parser (up to 5MB to support batch sync & small Base64 avatars)
  app.use(express.json({ limit: "5mb" }));

  // 3. Structured HTTP request logging
  app.use(
    pinoHttp({
      logger,
    }),
  );

  // 4. Global API rate limiter
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "TOO_MANY_REQUESTS",
      message: "Too many requests from this IP, please try again later.",
    },
  });
  app.use(apiLimiter);

  // 5. Override res.json to safely serialize any BigInt values automatically
  app.use((_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = (body?: unknown) => {
      return originalJson(sanitizeBigIntForJson(body));
    };
    next();
  });

  // 6. Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "hisabkhata-api",
      timestamp: Date.now(),
    });
  });

  // 7. Authentication & Profile Routes (/auth/*)
  app.use("/auth", authRouter);

  // 8. 404 Fallback
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: "NOT_FOUND",
      message: "The requested endpoint does not exist.",
    });
  });

  // 9. Global Error Handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err }, "Unhandled API error");
    res.status(500).json({
      error: "INTERNAL_SERVER_ERROR",
      message:
        env.NODE_ENV === "production"
          ? "An unexpected error occurred."
          : err.message,
    });
  });

  return app;
}

export const app = createApp();
