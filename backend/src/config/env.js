import { z } from "zod";

const envSchema = z
  .object({
    PORT: z.coerce.number().default(3001),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().url().optional(),
    RUN_MIGRATIONS_ON_START: z
      .string()
      .optional()
      .transform((s) => {
        if (s === undefined) return undefined;
        const lower = s.toLowerCase();
        return lower === "true" || lower === "1" || lower === "yes";
      }),
    AI_SERVICE_URL: z.string().url().default("http://127.0.0.1:8000"),
    AI_SERVICE_TIMEOUT_MS: z.coerce.number().min(1000).max(180_000).default(25_000),
    AI_SERVICE_GENERATE_TIMEOUT_MS: z.coerce
      .number()
      .min(5000)
      .max(180_000)
      .default(120_000),
    FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
    TWITTER_API_KEY: z.string().optional(),
    TWITTER_API_SECRET: z.string().optional(),
    TWITTER_ACCESS_TOKEN: z.string().optional(),
    TWITTER_ACCESS_SECRET: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.DATABASE_URL) {
        ctx.addIssue({
          code: "custom",
          message: "DATABASE_URL is required in production",
          path: ["DATABASE_URL"],
        });
      }
    }
  });

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();

export function shouldRunMigrationsOnStart() {
  if (!env.DATABASE_URL) return false;
  if (typeof env.RUN_MIGRATIONS_ON_START === "boolean") return env.RUN_MIGRATIONS_ON_START;
  return env.NODE_ENV === "development";
}

export function isDatabaseEnabled() {
  return Boolean(env.DATABASE_URL);
}

export function twitterCredentialsConfigured() {
  return Boolean(
    env.TWITTER_API_KEY &&
      env.TWITTER_API_SECRET &&
      env.TWITTER_ACCESS_TOKEN &&
      env.TWITTER_ACCESS_SECRET,
  );
}
