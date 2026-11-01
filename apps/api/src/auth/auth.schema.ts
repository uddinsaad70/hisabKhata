// apps/api/src/auth/auth.schema.ts
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Valid email or identifier is required"),
  password: z
    .string()
    .min(4, "Password must be at least 4 characters")
    .max(128),
  deviceId: z.string().trim().min(1, "deviceId is required"),
  deviceName: z.string().trim().optional(),
  platform: z.enum(["android", "ios", "web"]).optional(),
  avatarBase64: z.string().nullable().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
  deviceId: z.string().trim().min(1, "deviceId is required"),
  deviceName: z.string().trim().optional(),
  platform: z.enum(["android", "ios", "web"]).optional(),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(1, "Google idToken is required"),
  deviceId: z.string().trim().min(1, "deviceId is required"),
  deviceName: z.string().trim().optional(),
  platform: z.enum(["android", "ios", "web"]).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
  deviceId: z.string().trim().min(1, "deviceId is required"),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  avatarBase64: z.string().nullable().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
