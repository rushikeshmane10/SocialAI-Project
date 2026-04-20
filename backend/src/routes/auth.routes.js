import { Router } from "express";
import { loginHandler } from "../controllers/auth.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const authRouter = Router();
authRouter.post("/login", asyncHandler(loginHandler));
