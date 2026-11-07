// apps/api/src/auth/auth.service.ts
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import { createHash, randomBytes } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import type {
  GoogleAuthInput,
  LoginInput,
  RefreshInput,
  RegisterInput,
  UpdateProfileInput,
} from "./auth.schema.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export class AuthError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface AuthResponsePayload {
  user: {
    id: string;
    email: string;
    name: string;
    avatarBase64: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

/**
 * Computes SHA-256 hash of a raw refresh token so plain tokens are never stored in DB.
 */
export function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Signs a short-lived 15-minute JWT Access Token.
 */
export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });
}

/**
 * Verifies a Google ID Token (supports custom verifier injection for integration tests).
 */
type GoogleVerifierFn = (idToken: string) => Promise<GoogleTokenPayload>;

let googleVerifier: GoogleVerifierFn = async (idToken: string) => {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID || undefined,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new AuthError(
      401,
      "INVALID_GOOGLE_TOKEN",
      "Invalid Google ID token.",
    );
  }
  return {
    sub: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name,
    picture: payload.picture,
  };
};

export function setGoogleTokenVerifierForTesting(fn: GoogleVerifierFn): void {
  googleVerifier = fn;
}

/**
 * Upserts the user's device and issues a fresh Access Token + 30-day Refresh Token pair.
 */
async function issueSessionTokens(params: {
  user: {
    id: string;
    email: string;
    name: string;
    avatarBase64: string | null;
  };
  deviceId: string;
  deviceName?: string;
  platform?: string;
}): Promise<AuthResponsePayload> {
  const { user, deviceId, deviceName, platform } = params;

  await prisma.device.upsert({
    where: { deviceId },
    update: {
      userId: user.id,
      ...(deviceName ? { deviceName } : {}),
      ...(platform ? { platform } : {}),
      lastSeenAt: new Date(),
    },
    create: {
      deviceId,
      userId: user.id,
      deviceName: deviceName ?? null,
      platform: platform ?? null,
      lastSeenAt: new Date(),
    },
  });

  const rawRefreshToken = `rt_${randomBytes(32).toString("hex")}`;
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      deviceId,
      tokenHash,
      expiresAt,
    },
  });

  const accessToken = signAccessToken(user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarBase64: user.avatarBase64,
    },
    accessToken,
    refreshToken: rawRefreshToken,
  };
}

/**
 * 1. Register a new user with Email & Password (Argon2id hashed).
 */
export async function registerUser(
  input: RegisterInput,
): Promise<AuthResponsePayload> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existing) {
    throw new AuthError(
      409,
      "EMAIL_ALREADY_EXISTS",
      "An account with this email already exists.",
    );
  }

  const passwordHash = await argon2.hash(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      avatarBase64: input.avatarBase64 ?? null,
    },
  });

  return issueSessionTokens({
    user,
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    platform: input.platform,
  });
}

/**
 * 2. Login an existing user with Email & Password.
 */
export async function loginUser(
  input: LoginInput,
): Promise<AuthResponsePayload> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || !user.passwordHash) {
    throw new AuthError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password.",
    );
  }

  const validPassword = await argon2.verify(user.passwordHash, input.password);
  if (!validPassword) {
    throw new AuthError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password.",
    );
  }

  return issueSessionTokens({
    user,
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    platform: input.platform,
  });
}

/**
 * 3. Authenticate with Google OAuth (supports injected test verifier, ID Token, and Access Token).
 */
export async function authenticateWithGoogle(
  input: GoogleAuthInput,
): Promise<AuthResponsePayload> {
  let payload: GoogleTokenPayload;

  try {
    payload = await googleVerifier(input.idToken);
  } catch {
    // Fallback for OAuth2 access_token returned by expo-auth-session popup
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${input.idToken}` },
      },
    );

    if (!userInfoRes.ok) {
      throw new AuthError(
        401,
        "INVALID_GOOGLE_TOKEN",
        "Google token verification failed.",
      );
    }

    const raw = (await userInfoRes.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    if (!raw.sub || !raw.email) {
      throw new AuthError(
        401,
        "INVALID_GOOGLE_PAYLOAD",
        "Google token did not return a valid email or subject.",
      );
    }

    payload = {
      sub: raw.sub,
      email: raw.email.toLowerCase().trim(),
      name: raw.name,
      picture: raw.picture,
    };
  }

  const normalizedEmail = payload.email.toLowerCase().trim();
  const displayName = payload.name?.trim() || normalizedEmail.split("@")[0];

  let user = await prisma.user.findFirst({
    where: {
      OR: [{ googleSub: payload.sub }, { email: normalizedEmail }],
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: displayName,
        googleSub: payload.sub,
      },
    });
  } else if (!user.googleSub) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleSub: payload.sub },
    });
  }

  return issueSessionTokens({
    user,
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    platform: input.platform,
  });
}

/**
 * 4. Rotate Refresh Token: revokes old token and issues a new pair.
 */
export async function rotateRefreshToken(
  input: RefreshInput,
): Promise<AuthResponsePayload> {
  const tokenHash = hashRefreshToken(input.refreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    !storedToken ||
    storedToken.revokedAt !== null ||
    storedToken.deviceId !== input.deviceId ||
    storedToken.expiresAt.getTime() <= Date.now()
  ) {
    throw new AuthError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Refresh token is invalid, expired, or already revoked.",
    );
  }

  const revokeResult = await prisma.refreshToken.updateMany({
    where: { id: storedToken.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  if (revokeResult.count === 0) {
    throw new AuthError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Refresh token was already used.",
    );
  }

  return issueSessionTokens({
    user: storedToken.user,
    deviceId: input.deviceId,
  });
}

/**
 * 5. Update User Profile (Name & Avatar Base64 Photo).
 */
export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput,
) {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.avatarBase64 !== undefined
        ? { avatarBase64: input.avatarBase64 }
        : {}),
    },
  });

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    avatarBase64: updated.avatarBase64,
  };
}

/**
 * Permanently deletes a user account and all associated businesses, customers,
 * entries, devices, and refresh tokens via PostgreSQL ON DELETE CASCADE (CP28).
 */
export async function deleteUserAccountPermanently(
  userId: string,
): Promise<void> {
  await prisma.user.delete({
    where: { id: userId },
  });
}
