import "dotenv/config";
import { createServer as createHttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { fetchAndLogMCPTools } from "./composio/mcpTools.js";
import { env, isDatabaseEnabled } from "./config/env.js";
import { createServer } from "./createServer.js";
import { closeSequelize } from "./db/sequelize.js";
import { socketAuth } from "./middlewares/socketAuth.js";
import { setupSocketGenerationRoomHandlers } from "./services/socketGenerationRooms.js";

const app = await createServer();
const logger = app.locals.logger;
const httpServer = createHttpServer(app);

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  /** Match large JSON on /ai/callback/generate-complete (variations carry base64 images). */
  maxHttpBufferSize: 32e6,
});
io.use(socketAuth);
setupSocketGenerationRoomHandlers(io);
app.locals.io = io;

const server = httpServer.listen(env.PORT, "0.0.0.0", () => {
  logger.info(`Backend listening on http://localhost:${env.PORT}`);
  void fetchAndLogMCPTools();
});

const shutdown = async () => {
  io.close();
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
