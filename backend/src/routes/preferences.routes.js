import { Router } from "express";
import { getPreferencesHandler, logPreferencesHandler } from "../controllers/preferences.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireUserId } from "../middlewares/authenticate.js";

export const preferencesRouter = Router();
preferencesRouter.get("/preferences/me", requireUserId, asyncHandler(getPreferencesHandler));
preferencesRouter.post("/preferences/log", requireUserId, asyncHandler(logPreferencesHandler));
