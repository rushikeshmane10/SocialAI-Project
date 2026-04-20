import "dotenv/config";
import { env, isDatabaseEnabled } from "./config/env.js";
import { createServer } from "./createServer.js";
import { closeSequelize } from "./db/sequelize.js";

const app = await createServer();
const logger = app.locals.logger;

const server = app.listen(env.PORT, "0.0.0.0", () => {
  logger.info(`Backend listening on http://localhost:${env.PORT}`);
});

const shutdown = async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve(undefined)));
  });
  if (isDatabaseEnabled()) {
    await closeSequelize();
  }
  process.exit(0);
};
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());

server.on("error", (err) => {
  logger.error(err);
  process.exit(1);
});
