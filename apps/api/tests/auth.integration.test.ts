// apps/api/tests/auth.integration.test.ts
import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { app } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { setGoogleTokenVerifierForTesting } from "../src/auth/auth.service.js";

describe("CP21: Auth Register, Login, Google Auth, Profile Avatar & Refresh Rotation", () => {
  const uniqueTag = randomUUID().slice(0, 8);
  const testEmail = `merchant_${uniqueTag}@hisabkhata.com`;
  const googleEmail = `google_${uniqueTag}@hisabkhata.com`;
  const deviceId = `dev_${uniqueTag}`;

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: { in: [testEmail, googleEmail] },
      },
    });
    await prisma.$disconnect();
  }, 30000);

  it("registers a new user, rejects duplicate email, logs in, updates avatar, and rotates refresh tokens", async () => {
    // 1. Register User
    const regRes = await request(app).post("/auth/register").send({
      name: "Saad Enterprise",
      email: testEmail,
      password: "securePassword123",
      deviceId,
      deviceName: "Samsung Galaxy A55",
      platform: "android",
      avatarBase64: "data:image/jpeg;base64,dGVzdA==",
    });

    expect(regRes.status).toBe(201);
    expect(regRes.body.user.email).toBe(testEmail);
    expect(regRes.body.user.avatarBase64).toBe(
      "data:image/jpeg;base64,dGVzdA==",
    );
    expect(typeof regRes.body.accessToken).toBe("string");
    expect(regRes.body.refreshToken).toMatch(/^rt_/);

    // 2. Reject Duplicate Registration
    const dupRes = await request(app).post("/auth/register").send({
      name: "Duplicate",
      email: testEmail,
      password: "securePassword123",
      deviceId,
    });
    expect(dupRes.status).toBe(409);

    // 3. Reject Wrong Password on Login
    const badLoginRes = await request(app).post("/auth/login").send({
      email: testEmail,
      password: "wrongPassword",
      deviceId,
    });
    expect(badLoginRes.status).toBe(401);

    // 4. Valid Login
    const loginRes = await request(app).post("/auth/login").send({
      email: testEmail,
      password: "securePassword123",
      deviceId,
    });
    expect(loginRes.status).toBe(200);
    const firstRefreshToken = loginRes.body.refreshToken as string;
    const accessToken = loginRes.body.accessToken as string;

    // 5. Update Profile Name & Avatar via PATCH /auth/profile
    const profileRes = await request(app)
      .patch("/auth/profile")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Md. Saad Uddin",
        avatarBase64: "data:image/jpeg;base64,bmV3QXZhdGFy",
      });
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.user.name).toBe("Md. Saad Uddin");
    expect(profileRes.body.user.avatarBase64).toBe(
      "data:image/jpeg;base64,bmV3QXZhdGFy",
    );

    // 6. Rotate Refresh Token (1st use succeeds and issues new token)
    const refreshRes1 = await request(app).post("/auth/refresh").send({
      refreshToken: firstRefreshToken,
      deviceId,
    });
    expect(refreshRes1.status).toBe(200);
    const secondRefreshToken = refreshRes1.body.refreshToken as string;
    expect(secondRefreshToken).not.toBe(firstRefreshToken);

    // 7. Reusing the old revoked Refresh Token must fail with 401 Unauthorized
    const replayRes = await request(app).post("/auth/refresh").send({
      refreshToken: firstRefreshToken,
      deviceId,
    });
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error).toBe("INVALID_REFRESH_TOKEN");
  }, 30000);

  it("authenticates via Google ID token and creates/links user account", async () => {
    setGoogleTokenVerifierForTesting(async () => ({
      sub: `google_sub_${uniqueTag}`,
      email: googleEmail,
      name: "Google Merchant",
    }));

    const googleRes = await request(app).post("/auth/google").send({
      idToken: "mock-google-id-token",
      deviceId,
      platform: "android",
    });

    expect(googleRes.status).toBe(200);
    expect(googleRes.body.user.email).toBe(googleEmail);
    expect(googleRes.body.user.name).toBe("Google Merchant");
    expect(typeof googleRes.body.accessToken).toBe("string");
  }, 30000);
});
