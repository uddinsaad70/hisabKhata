// apps/mobile/utils/userAuthService.ts
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { v7 as uuidv7 } from "uuid";
import { getDbAdapter } from "../db/client";
import { claimLocalBusinessesForUser } from "../db/businessQueries";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarBase64: string | null;
  lastSyncedAt: string | null;
}

const ACCESS_TOKEN_KEY = "hk_access_token_v1";
const REFRESH_TOKEN_KEY = "hk_refresh_token_v1";
const DEVICE_ID_KEY = "hk_device_id_v1";
const USER_PROFILE_CACHE_KEY = "hk_user_profile_cache_v1";
const POST_LOGOUT_GUEST_KEY = "hk_post_logout_guest_v1";
const PENDING_LOGOUT_SYNC_KEY = "hk_pending_logout_sync_v1";

export interface PendingLogoutSyncSession {
  userId: string;
  accessToken: string;
  refreshToken: string;
}

export async function isPostLogoutGuestSession(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const val = await SecureStore.getItemAsync(POST_LOGOUT_GUEST_KEY);
  return val === "true";
}

export async function setPostLogoutGuestSession(active: boolean): Promise<void> {
  if (Platform.OS === "web") return;
  if (active) {
    await SecureStore.setItemAsync(POST_LOGOUT_GUEST_KEY, "true");
  } else {
    await SecureStore.deleteItemAsync(POST_LOGOUT_GUEST_KEY);
  }
}

export async function savePendingLogoutSyncSession(): Promise<void> {
  if (Platform.OS === "web") return;
  const profile = await getCurrentUserProfile();
  const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (profile && accessToken && refreshToken) {
    const payload: PendingLogoutSyncSession = {
      userId: profile.id,
      accessToken,
      refreshToken,
    };
    await SecureStore.setItemAsync(
      PENDING_LOGOUT_SYNC_KEY,
      JSON.stringify(payload),
    );
  }
}

export async function getPendingLogoutSyncSession(): Promise<PendingLogoutSyncSession | null> {
  if (Platform.OS === "web") return null;
  try {
    const raw = await SecureStore.getItemAsync(PENDING_LOGOUT_SYNC_KEY);
    return raw ? (JSON.parse(raw) as PendingLogoutSyncSession) : null;
  } catch {
    return null;
  }
}

export async function clearPendingLogoutSyncSession(): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.deleteItemAsync(PENDING_LOGOUT_SYNC_KEY);
}

export async function wakeUpCloudServer(
  timeoutMs: number = 45000,
): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  return "http://localhost:4000";
}

/**
 * Builds a Google OAuth-compatible web redirect bridge URL from getApiBaseUrl().
 * Automatically appends .nip.io for local LAN IPs or uses the production domain directly.
 */
export function getGoogleOAuthBridgeUrl(): string {
  const base = getApiBaseUrl();
  const ipv4Processed = base.replace(
    /^(https?:\/\/)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/i,
    "$1$2.nip.io$3",
  );
  return `${ipv4Processed}/auth/google/bridge`;
}

/**
 * Gets or creates a persistent UUID v7 device identifier for this phone.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  if (Platform.OS === "web") return "web-device-001";
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = uuidv7();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * Reads the currently signed-in user's cached profile from SecureStore.
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  if (Platform.OS === "web") return null;
  try {
    const raw = await SecureStore.getItemAsync(USER_PROFILE_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

async function saveSessionData(
  user: UserProfile,
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  await SecureStore.setItemAsync(USER_PROFILE_CACHE_KEY, JSON.stringify(user));
}

/**
 * Registers a new user on the backend (POST /auth/register) and claims local businesses.
 */
export async function registerUserAccount(params: {
  name: string;
  identifier: string;
  password: string;
  avatarBase64?: string | null;
}): Promise<UserProfile> {
  const deviceId = await getOrCreateDeviceId();
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name.trim(),
      email: params.identifier.trim().toLowerCase(),
      password: params.password,
      deviceId,
      deviceName: `${Platform.OS.toUpperCase()} Device`,
      platform: Platform.OS === "ios" ? "ios" : "android",
      avatarBase64: params.avatarBase64 ?? null,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Registration failed.");
  }

  const profile: UserProfile = {
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    avatarBase64: data.user.avatarBase64 ?? null,
    lastSyncedAt: null,
  };

  await saveSessionData(profile, data.accessToken, data.refreshToken);

  if (Platform.OS !== "web") {
    const db = getDbAdapter();
    await claimLocalBusinessesForUser(db, profile.id);
  }

  return profile;
}

/**
 * Logs in an existing user (POST /auth/login) and claims any unowned local businesses.
 */
export async function loginUserAccount(params: {
  identifier: string;
  password: string;
}): Promise<UserProfile> {
  const deviceId = await getOrCreateDeviceId();
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: params.identifier.trim().toLowerCase(),
      password: params.password,
      deviceId,
      deviceName: `${Platform.OS.toUpperCase()} Device`,
      platform: Platform.OS === "ios" ? "ios" : "android",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Invalid email or password.");
  }

  const profile: UserProfile = {
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    avatarBase64: data.user.avatarBase64 ?? null,
    lastSyncedAt: null,
  };

  await saveSessionData(profile, data.accessToken, data.refreshToken);

  if (Platform.OS !== "web") {
    const db = getDbAdapter();
    await claimLocalBusinessesForUser(db, profile.id);
  }

  return profile;
}

export async function getValidAccessToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

/**
 * Rotates the 30-day refresh token via POST /auth/refresh when access token expires.
 */
export async function refreshSessionTokens(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const deviceId = await getOrCreateDeviceId();
  const baseUrl = getApiBaseUrl();

  const res = await fetch(`${baseUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken, deviceId }),
  });

  if (!res.ok) {
    await logoutUserAccount();
    return null;
  }

  const data = await res.json();
  const current = await getCurrentUserProfile();
  const updatedProfile: UserProfile = {
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    avatarBase64: data.user.avatarBase64 ?? null,
    lastSyncedAt: current?.lastSyncedAt ?? null,
  };

  await saveSessionData(updatedProfile, data.accessToken, data.refreshToken);
  return data.accessToken;
}

/**
 * Updates user's name or Base64 profile photo on the cloud backend (PATCH /auth/profile).
 */
export async function updateActiveUserProfile(updates: {
  name?: string;
  avatarBase64?: string | null;
  lastSyncedAt?: string | null;
}): Promise<UserProfile | null> {
  const current = await getCurrentUserProfile();
  if (!current) return null;

  if (
    updates.lastSyncedAt !== undefined &&
    updates.name === undefined &&
    updates.avatarBase64 === undefined
  ) {
    const next = { ...current, lastSyncedAt: updates.lastSyncedAt };
    await SecureStore.setItemAsync(
      USER_PROFILE_CACHE_KEY,
      JSON.stringify(next),
    );
    return next;
  }

  const baseUrl = getApiBaseUrl();
  let token = await getValidAccessToken();
  if (!token) throw new Error("Not authenticated.");

  let res = await fetch(`${baseUrl}/auth/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...(updates.name !== undefined ? { name: updates.name } : {}),
      ...(updates.avatarBase64 !== undefined
        ? { avatarBase64: updates.avatarBase64 }
        : {}),
    }),
  });

  if (res.status === 401) {
    token = await refreshSessionTokens();
    if (!token) throw new Error("Session expired. Please login again.");
    res = await fetch(`${baseUrl}/auth/profile`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.avatarBase64 !== undefined
          ? { avatarBase64: updates.avatarBase64 }
          : {}),
      }),
    });
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update profile.");
  }

  const updatedProfile: UserProfile = {
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    avatarBase64: data.user.avatarBase64 ?? null,
    lastSyncedAt: updates.lastSyncedAt ?? current.lastSyncedAt,
  };

  await SecureStore.setItemAsync(
    USER_PROFILE_CACHE_KEY,
    JSON.stringify(updatedProfile),
  );
  return updatedProfile;
}

/**
 * Clears session tokens and cached profile from SecureStore on logout.
 */
export async function logoutUserAccount(): Promise<void> {
  if (Platform.OS === "web") return;
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_PROFILE_CACHE_KEY);
  await setPostLogoutGuestSession(true);
}

/**
 * Authenticates or registers a user via real Google OAuth token (POST /auth/google).
 */
export async function loginWithGoogleToken(
  googleToken: string,
): Promise<UserProfile> {
  const deviceId = await getOrCreateDeviceId();
  const baseUrl = getApiBaseUrl();

  // Clean up any legacy dummy account cache from SecureStore
  if (Platform.OS !== "web") {
    await SecureStore.deleteItemAsync("hk_known_google_accounts_v1");
  }

  const res = await fetch(`${baseUrl}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken: googleToken,
      deviceId,
      deviceName: `${Platform.OS.toUpperCase()} Device`,
      platform: Platform.OS === "ios" ? "ios" : "android",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Google authentication failed.");
  }

  const profile: UserProfile = {
    id: data.user.id,
    name: data.user.name,
    email: data.user.email,
    avatarBase64: data.user.avatarBase64 ?? null,
    lastSyncedAt: null,
  };

  await saveSessionData(profile, data.accessToken, data.refreshToken);

  if (Platform.OS !== "web") {
    const db = getDbAdapter();
    await claimLocalBusinessesForUser(db, profile.id);
  }

  return profile;
}

/**
 * Permanently deletes the user's cloud account via DELETE /auth/account,
 * clears local SecureStore tokens, and wipes cloud-owned data from local SQLite.
 */
export async function deleteCurrentUserAccount(): Promise<void> {
  const baseUrl = getApiBaseUrl();
  let token = await getValidAccessToken();
  if (!token) {
    throw new Error("Not authenticated.");
  }

  let res = await fetch(`${baseUrl}/auth/account`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    token = await refreshSessionTokens();
    if (!token) {
      throw new Error("Session expired. Please sign in again.");
    }
    res = await fetch(`${baseUrl}/auth/account`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Failed to delete account.");
  }

  await logoutUserAccount();
}
