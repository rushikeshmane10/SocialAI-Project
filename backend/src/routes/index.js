import { env, isDatabaseEnabled, shouldRunMigrationsOnStart } from "../config/env.js";
import { closeSequelize, getSequelize } from "../db/sequelize.js";
import { runMigrations } from "../db/migrate.js";
import { createAiRouter } from "./ai.routes.js";
import { authRouter } from "./auth.routes.js";
import { behaviorRouter } from "./behavior.routes.js";
import { healthRouter } from "./health.routes.js";
import { postTweetRouter } from "./post.routes.js";
import { postsRouter } from "./posts.routes.js";
import { preferencesRouter } from "./preferences.routes.js";
import { profileRouter } from "./profile.routes.js";
import { satisfactionRouter } from "./satisfaction.routes.js";
import { apiErrorBody } from "../utils/response.js";

/**
 * @param {import('express').Express} app
 */
export async function registerRoutes(app) {
  const logger = app.locals.logger;
  let databaseLive = false;

  if (isDatabaseEnabled()) {
    try {
      const sequelize = getSequelize();
      await sequelize.authenticate();
      databaseLive = true;
      if (shouldRunMigrationsOnStart()) {
        await runMigrations(sequelize);
      }
    } catch (err) {
      const code = err?.parent?.code ?? err?.original?.code;
      const poolerHint =
        env.DATABASE_URL?.includes("db.") &&
        env.DATABASE_URL?.includes("supabase.co") &&
        (code === "ENOTFOUND" || code === "ENETUNREACH")
          ? " Supabase direct host is often IPv6-only: use the pooler URI from Project Settings → Database (aws-0-<region>.pooler.supabase.com) if this persists."
          : "";
      logger.warn(
        { err },
        `DATABASE_URL is set but the database is unreachable at startup. Auth and DB routes are still mounted; login may return 503 until the database is reachable.${poolerHint}`,
      );
      await closeSequelize().catch(() => {});
    }

    app.use("/auth", authRouter);
    app.use(profileRouter);
    app.use(preferencesRouter);
    app.use(postsRouter);
    app.use(satisfactionRouter);
    app.use(behaviorRouter);
  } else {
    app.post("/auth/login", (req, res) => {
      res.status(503).json(
        apiErrorBody(
          "SERVICE_UNAVAILABLE",
          "Login requires DATABASE_URL. Set it in the backend environment and restart the server.",
        ),
      );
    });
  }

  app.use(healthRouter);
  app.use(createAiRouter(databaseLive));
  app.use(postTweetRouter);
}
