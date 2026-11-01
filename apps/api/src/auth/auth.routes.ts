// apps/api/src/auth/auth.routes.ts
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import {
  googleAuthSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  updateProfileSchema,
} from "./auth.schema.js";
import {
  AuthError,
  authenticateWithGoogle,
  loginUser,
  registerUser,
  rotateRefreshToken,
  updateUserProfile,
} from "./auth.service.js";

export const authRouter = Router();

// Strict rate limiter for /auth/* endpoints (skip in test mode if needed, or allow 25 reqs per 15m)
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "test" ? 100 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_AUTH_ATTEMPTS",
    message: "Too many authentication attempts, please try again later.",
  },
});

authRouter.use(authRateLimiter);

function handleRouteError(err: unknown, res: Response): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: err.errors[0]?.message || "Invalid request payload.",
      details: err.errors,
    });
    return;
  }
  if (err instanceof AuthError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
    });
    return;
  }
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "Authentication error",
  });
}

authRouter.post("/register", async (req: Request, res: Response) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);
    res.status(201).json(result);
  } catch (err) {
    handleRouteError(err, res);
  }
});

authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await loginUser(input);
    res.status(200).json(result);
  } catch (err) {
    handleRouteError(err, res);
  }
});

authRouter.post("/google", async (req: Request, res: Response) => {
  try {
    const input = googleAuthSchema.parse(req.body);
    const result = await authenticateWithGoogle(input);
    res.status(200).json(result);
  } catch (err) {
    handleRouteError(err, res);
  }
});

authRouter.post("/refresh", async (req: Request, res: Response) => {
  try {
    const input = refreshSchema.parse(req.body);
    const result = await rotateRefreshToken(input);
    res.status(200).json(result);
  } catch (err) {
    handleRouteError(err, res);
  }
});

authRouter.patch("/profile", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header.",
      });
      return;
    }

    const token = authHeader.slice(7);
    let userId: string;
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
        sub: string;
      };
      userId = decoded.sub;
    } catch {
      res.status(401).json({
        error: "INVALID_ACCESS_TOKEN",
        message: "Access token is invalid or expired.",
      });
      return;
    }

    const input = updateProfileSchema.parse(req.body);
    const user = await updateUserProfile(userId, input);
    res.status(200).json({ user });
  } catch (err) {
    handleRouteError(err, res);
  }
});
