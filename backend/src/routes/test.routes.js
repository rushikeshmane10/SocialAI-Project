import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { testLinkedinImagePostHandler } from "../controllers/test.controller.js";

export const testRouter = Router();

// TEST ONLY: isolated Composio LinkedIn image post endpoint.
testRouter.post("/test/linkedin-image-post", asyncHandler(testLinkedinImagePostHandler));
