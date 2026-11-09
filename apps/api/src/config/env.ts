import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file if available
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/crewconnect?replicaSet=rs0"),
  MONGODB_DB_NAME: z.string().default("crewconnect"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters long")
    .default("default_development_secret_key_that_is_at_least_32_characters_long!"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000), // 15 mins
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
});

export type EnvConfig = z.infer<typeof EnvSchema>;

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
