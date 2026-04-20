import { Router } from "express";
import { postTweetHandler } from "../controllers/post.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const postTweetRouter = Router();
postTweetRouter.post("/post/tweet", asyncHandler(postTweetHandler));
