// apps/api/src/config/env.ts
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .default(
      "postgresql://postgres:postgrespassword@localhost:5432/hisabkhata_dev?schema=public",
    ),
  TEST_DATABASE_URL: z
    .string()
    .optional()
    .default(
      "postgresql://postgres:postgrespassword@localhost:5433/hisabkhata_test?schema=public",
    ),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, "JWT_ACCESS_SECRET must be at least 16 characters")
    .default("hisabkhata_dev_access_secret_key_32_chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, "JWT_REFRESH_SECRET must be at least 16 characters")
    .default("hisabkhata_dev_refresh_secret_key_32_chars"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const env: EnvConfig = envSchema.parse(process.env);
