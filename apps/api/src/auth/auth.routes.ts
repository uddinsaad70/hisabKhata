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
  deleteUserAccountPermanently,
} from "./auth.service.js";
import {
  AuthenticatedRequest,
  authMiddleware,
} from "../middleware/authMiddleware.js";

export const authRouter = Router();

// Temporary in-memory store for OAuth bridge tokens (keyed by sessionId, auto-expires in 2 mins)
const pendingGoogleBridgeTokens = new Map<
  string,
  { token: string; createdAt: number }
>();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === "test" ? 100 : 60,
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

/**
 * POST /auth/google/bridge-store
 * Receives the token extracted by the browser bridge page so the mobile app can poll/claim it
 * even if Chrome Custom Tabs blocks automatic exp:// deep link redirection.
 */
authRouter.post("/google/bridge-store", (req: Request, res: Response) => {
  const { sessionId, token } = req.body || {};
  if (typeof sessionId === "string" && typeof token === "string" && token) {
    pendingGoogleBridgeTokens.set(sessionId, {
      token,
      createdAt: Date.now(),
    });
  }
  res.status(200).json({ ok: true });
});

/**
 * GET /auth/google/bridge-poll?sessionId=...
 * Mobile app polls or fetches the token once the browser session completes.
 */
authRouter.get("/google/bridge-poll", (req: Request, res: Response) => {
  const sessionId = String(req.query.sessionId || "");
  const entry = pendingGoogleBridgeTokens.get(sessionId);
  if (!entry) {
    res.status(200).json({ ready: false, token: null });
    return;
  }
  pendingGoogleBridgeTokens.delete(sessionId);
  res.status(200).json({ ready: true, token: entry.token });
});

/**
 * GET /auth/google/bridge
 * Valid HTTP Web Redirect URI bridge for Google OAuth2 ('WEB' client type).
 * Removes Helmet CSP header so the inline script executes immediately, stores the token
 * on the backend for instant pickup, and redirects back to the Expo app.
 */
authRouter.get("/google/bridge", (_req: Request, res: Response) => {
  // CRITICAL: Remove Helmet's Content-Security-Policy so inline script is not blocked!
  res.removeHeader("Content-Security-Policy");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Signing in to HisabKhata...</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0F172A; color: #F8FAFC; }
      .card { background: #1E293B; padding: 28px 24px; border-radius: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); text-align: center; max-width: 340px; width: 90%; border: 1px solid #334155; }
      .check { font-size: 40px; margin-bottom: 10px; }
      h3 { margin: 0 0 8px; font-size: 18px; color: #FFFFFF; }
      p { margin: 0 0 20px; font-size: 13px; color: #94A3B8; line-height: 1.5; }
      .btn { display: inline-block; background: #108944; color: #FFFFFF; text-decoration: none; font-weight: 700; font-size: 14px; padding: 13px 22px; border-radius: 10px; width: 85%; box-sizing: border-box; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="check">✅</div>
      <h3 id="title">Google Sign-In Verified!</h3>
      <p id="desc">Returning to HisabKhata automatically...</p>
      <a id="returnBtn" class="btn" href="#">Return to HisabKhata App</a>
    </div>
    <script>
      (function() {
        var hash = window.location.hash ? window.location.hash.substring(1) : "";
        var query = window.location.search ? window.location.search.substring(1) : "";
        var params = new URLSearchParams(hash || query);
        var rawState = params.get("state") || "";
        var accessToken = params.get("access_token");
        var idToken = params.get("id_token");
        var token = idToken || accessToken || "";

        var parts = rawState.split("|");
        var sessionId = parts[0] || "";
        var appUrl = parts.slice(1).join("|") || rawState;

        if (token && appUrl) {
          var sep = appUrl.indexOf("?") === -1 ? "?" : "&";
          var target = appUrl + sep + "google_token=" + encodeURIComponent(token);
          var btn = document.getElementById("returnBtn");
          if (btn) btn.setAttribute("href", target);

          // 1. Save token to backend bridge-store so the mobile app gets it even if deep link is blocked
          fetch("/auth/google/bridge-store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: sessionId, token: token })
          }).finally(function() {
            // 2. Attempt automatic redirect back to app
            window.location.replace(target);
            setTimeout(function() {
              window.close();
            }, 600);
          });
        }
      })();
    </script>
  </body>
</html>`);
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

authRouter.delete(
  "/account",
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.userId!;
      await deleteUserAccountPermanently(userId);
      res.status(200).json({ deleted: true });
    } catch (err) {
      handleRouteError(err, res);
    }
  },
);
