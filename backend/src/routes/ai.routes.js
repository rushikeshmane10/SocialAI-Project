import { Router } from "express";
import { generateTweetHandlerLegacy, generateTweetHandlerPersist } from "../controllers/ai.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireUserId } from "../middlewares/authenticate.js";

export function createAiRouter(isDatabaseEnabled) {
  const r = Router();
  if (isDatabaseEnabled) {
    r.post("/ai/generate", requireUserId, asyncHandler(generateTweetHandlerPersist));
  } else {
    r.post("/ai/generate", asyncHandler(generateTweetHandlerLegacy));
  }
  return r;
}
