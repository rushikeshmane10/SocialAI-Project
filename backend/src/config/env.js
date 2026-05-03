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
    JSON_BODY_LIMIT: z.string().default("1mb"),
    FRONTEND_ORIGIN: z.string().default("http://localhost:5173"),
    JWT_SECRET: z.string().min(1).default("dev-jwt-secret"),
    SOCKET_BYPASS_JWT: z
      .string()
      .optional()
      .transform((s) => {
        if (s === undefined) return false;
        const lower = s.toLowerCase();
        return lower === "true" || lower === "1" || lower === "yes";
      }),
    SOCKET_BYPASS_SECRET: z.string().optional(),
    TWITTER_API_KEY: z.string().optional(),
    TWITTER_API_SECRET: z.string().optional(),
    TWITTER_ACCESS_TOKEN: z.string().optional(),
    TWITTER_ACCESS_SECRET: z.string().optional(),
    COMPOSIO_API_KEY: z.string().optional(),
    // TEST ONLY: entity id for /test/linkedin-image-post.
    COMPOSIO_ENTITY_ID: z.string().optional(),
    /** Optional override when LINKEDIN_GET_MY_INFO returns an unexpected shape (dev only). */
    COMPOSIO_LINKEDIN_AUTHOR_URN: z.string().optional(),
    /** Max decoded JPEG size (bytes) before sending to Composio LinkedIn post. */
    COMPOSIO_LINKEDIN_IMAGE_MAX_BYTES: z.coerce.number().min(50_000).max(5_000_000).default(900_000),
    /** Max longest edge (px) after resize for LinkedIn post images. */
    COMPOSIO_LINKEDIN_IMAGE_MAX_EDGE: z.coerce.number().min(256).max(4096).default(1600),
    /** Initial JPEG quality (1–100) for LinkedIn image compression; lowered in a loop if over budget. */
    COMPOSIO_LINKEDIN_IMAGE_JPEG_QUALITY_START: z.coerce.number().min(40).max(100).default(82),
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

export function composioConfigured() {
  return Boolean(env.COMPOSIO_API_KEY);
}
