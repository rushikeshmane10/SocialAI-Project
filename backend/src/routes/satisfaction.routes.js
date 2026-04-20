import { Router } from "express";
import { postSatisfactionHandler } from "../controllers/satisfaction.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireUserId } from "../middlewares/authenticate.js";

export const satisfactionRouter = Router();
satisfactionRouter.post("/posts/:id/satisfaction", requireUserId, asyncHandler(postSatisfactionHandler));
