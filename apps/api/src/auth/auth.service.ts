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

  // Equivalent Raw SQL:
  // INSERT INTO devices (device_id, user_id, device_name, platform, last_seen_at)
  // VALUES ($1, $2, $3, $4, clock_timestamp())
  // ON CONFLICT (device_id) DO UPDATE
  // SET user_id = EXCLUDED.user_id,
  //     device_name = COALESCE(EXCLUDED.device_name, devices.device_name),
  //     platform = COALESCE(EXCLUDED.platform, devices.platform),
  //     last_seen_at = clock_timestamp();
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

  // Equivalent Raw SQL:
  // INSERT INTO refresh_tokens (id, user_id, device_id, token_hash, expires_at)
  // VALUES (gen_random_uuid(), $1, $2, $3, $4);
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
  // Equivalent Raw SQL:
  // SELECT id FROM users WHERE email = $1 LIMIT 1;
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

  // Equivalent Raw SQL:
  // INSERT INTO users (id, email, name, password_hash, avatar_base64)
  // VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING *;
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
  // Equivalent Raw SQL:
  // SELECT * FROM users WHERE email = $1 LIMIT 1;
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
 * 3. Authenticate or Register via Google ID Token.
 */
export async function authenticateWithGoogle(
  input: GoogleAuthInput,
): Promise<AuthResponsePayload> {
  const googleProfile = await googleVerifier(input.idToken);

  // Equivalent Raw SQL:
  // SELECT * FROM users WHERE google_sub = $1 OR email = $2 LIMIT 1;
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ googleSub: googleProfile.sub }, { email: googleProfile.email }],
    },
  });

  if (!user) {
    // Equivalent Raw SQL:
    // INSERT INTO users (id, email, name, google_sub) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING *;
    user = await prisma.user.create({
      data: {
        email: googleProfile.email,
        name: googleProfile.name || googleProfile.email.split("@")[0],
        googleSub: googleProfile.sub,
      },
    });
  } else if (!user.googleSub) {
    // Link google_sub to existing email account
    // Equivalent Raw SQL:
    // UPDATE users SET google_sub = $1, updated_at = clock_timestamp() WHERE id = $2 RETURNING *;
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleSub: googleProfile.sub },
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

  // Equivalent Raw SQL:
  // SELECT rt.*, u.* FROM refresh_tokens rt
  // JOIN users u ON u.id = rt.user_id
  // WHERE rt.token_hash = $1 LIMIT 1;
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

  // Revoke the used refresh token immediately (Refresh Token Rotation)
  // Equivalent Raw SQL:
  // UPDATE refresh_tokens SET revoked_at = clock_timestamp() WHERE id = $1 AND revoked_at IS NULL;
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
  // Equivalent Raw SQL:
  // UPDATE users SET name = COALESCE($1, name), avatar_base64 = $2, updated_at = clock_timestamp()
  // WHERE id = $3 RETURNING id, email, name, avatar_base64;
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
