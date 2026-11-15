import dotenv from "dotenv";
import { z } from "zod";
import { DEFAULT_JOIN_REQUEST_EXPIRATION_HOURS } from "@crewconnect/shared";

// Load environment variables from .env file if available
dotenv.config();

export const DEFAULT_DEV_SECRET =
  "default_development_secret_key_that_is_at_least_32_characters_long!";

const BaseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/crewconnect?replicaSet=rs0"),
  MONGODB_DB_NAME: z.string().default("crewconnect"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long")
    .default(DEFAULT_DEV_SECRET),
  JWT_EXPIRES_IN: z.string().default("1d"),
  COOKIE_SECRET: z.string().optional(),
  COOKIE_SECURE: z
    .preprocess(
      (val) =>
        val === "true" || val === true
          ? true
          : val === "false" || val === false
            ? false
            : undefined,
      z.boolean().optional()
    )
    .optional(),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
  TRUST_PROXY: z
    .preprocess(
      (val) => {
        if (val === "true" || val === true) return 1;
        if (val === "false" || val === false) return false;
        if (typeof val === "string" && !isNaN(Number(val))) return Number(val);
        return val;
      },
      z.union([z.boolean(), z.number(), z.string()])
    )
    .optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(300), // 300 requests per 15m for SPA browsing
  AUTH_LOGIN_WINDOW_MS: z.coerce.number().default(900_000), // 15 mins
  AUTH_LOGIN_MAX_IP_ATTEMPTS: z.coerce.number().default(30), // 30 total login attempts per IP per 15m
  AUTH_LOGIN_MAX_FAILED_ATTEMPTS: z.coerce.number().default(5), // 5 consecutive failed logins per email+IP per 15m
  AUTH_REGISTER_WINDOW_MS: z.coerce.number().default(3_600_000), // 1 hour
  AUTH_REGISTER_MAX_ATTEMPTS: z.coerce.number().default(60), // 60 registrations per IP per hour (shared campus/hackathon networks)
  AUTH_REGISTER_BURST_WINDOW_MS: z.coerce.number().default(60_000), // 1 min burst window
  AUTH_REGISTER_BURST_MAX: z.coerce.number().default(10), // Max 10 rapid-fire registrations per minute per IP
  JOIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000), // 1 min
  JOIN_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(10), // 10 attempts
  JOIN_REQUEST_EXPIRATION_HOURS: z.coerce
    .number()
    .int()
    .min(1)
    .max(720)
    .default(DEFAULT_JOIN_REQUEST_EXPIRATION_HOURS),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
});

export const EnvSchema = BaseEnvSchema.superRefine((data, ctx) => {
  if (data.NODE_ENV === "production") {
    if (!data.JWT_SECRET || data.JWT_SECRET === DEFAULT_DEV_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message:
          "In production, JWT_SECRET is mandatory and cannot use the default development secret",
      });
    }
  }
});

export type EnvConfig = z.infer<typeof BaseEnvSchema>;

export function validateEnv(customEnv: Record<string, unknown> = process.env): EnvConfig {
  const result = EnvSchema.safeParse(customEnv);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => ` - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Environment validation failed:\n${errorDetails}`);
  }
  return result.data;
}

export const env = validateEnv();
