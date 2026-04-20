import { Router } from "express";
import { getProfileHandler, upsertProfileHandler } from "../controllers/profile.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireUserId } from "../middlewares/authenticate.js";

export const profileRouter = Router();
profileRouter.get("/profile", requireUserId, asyncHandler(getProfileHandler));
profileRouter.post("/profile", requireUserId, asyncHandler(upsertProfileHandler));
