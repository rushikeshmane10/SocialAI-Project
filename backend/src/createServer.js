import cors from "cors";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { requestIdMiddleware } from "./middlewares/requestContext.js";
import { registerRoutes } from "./routes/index.js";

export async function createServer() {
  const isDev = env.NODE_ENV === "development";

  const logger = isDev
    ? pino({
      level: "info",
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      },
    })
    : pino({ level: "warn" });

  const app = express();
  app.disable("x-powered-by");
  app.locals.logger = logger;

  app.use(requestIdMiddleware);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.requestId,
      customProps: (req) => ({ requestId: req.requestId }),
    }),
  );
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "x-request-id", "x-user-id"],
    }),
  );
  // Python completion webhook sends two base64 images + metadata; default 1mb is too small.
  app.use((req, res, next) => {
    const isGenerateCompleteCallback =
      req.method === "POST" && req.path === "/ai/callback/generate-complete";
    const limit = isGenerateCompleteCallback ? "32mb" : env.JSON_BODY_LIMIT;
    express.json({ limit })(req, res, next);
  });

  await registerRoutes(app);

  app.use(errorHandler);

  return app;
}
