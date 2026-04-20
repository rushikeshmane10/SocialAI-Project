import { Router } from "express";
import { getHealthHandler } from "../controllers/health.controller.js";

export const healthRouter = Router();
healthRouter.get("/health", getHealthHandler);
