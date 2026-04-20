import { Router } from "express";
import { postBehaviorEventHandler } from "../controllers/behavior.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireUserId } from "../middlewares/authenticate.js";

export const behaviorRouter = Router();
behaviorRouter.post("/behavior/event", requireUserId, asyncHandler(postBehaviorEventHandler));
