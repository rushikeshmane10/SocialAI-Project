import { Router } from "express";
import {
  connectionCallback,
  getConnectionStatus,
  initiateConnection,
  publishPost,
} from "../controllers/connections.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireUserId } from "../middlewares/authenticate.js";

export const connectionsRouter = Router();
connectionsRouter.get("/connections/status", requireUserId, asyncHandler(getConnectionStatus));
connectionsRouter.post(
  "/connections/:platform/initiate",
  requireUserId,
  asyncHandler(initiateConnection),
);
connectionsRouter.get(
  "/connections/:platform/callback",
  requireUserId,
  asyncHandler(connectionCallback),
);
connectionsRouter.post(
  "/connections/posts/:id/publish",
  requireUserId,
  asyncHandler(publishPost),
);
