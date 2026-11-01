// apps/api/src/middleware/authMiddleware.ts
import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Access token is missing or malformed.",
    });
    return;
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Access token is missing.",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
    req.userId = decoded.sub;
    next();
  } catch {
    res.status(401).json({
      error: "INVALID_ACCESS_TOKEN",
      message: "Access token is invalid or expired.",
    });
  }
}
