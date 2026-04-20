import { Router } from "express";
import {
  getPostByIdHandler,
  listPostsHandler,
  postFeedbackHandler,
  selectVariationHandler,
} from "../controllers/posts.controller.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { requireUserId } from "../middlewares/authenticate.js";

export const postsRouter = Router();
postsRouter.get("/posts", requireUserId, asyncHandler(listPostsHandler));
postsRouter.get("/posts/:id", requireUserId, asyncHandler(getPostByIdHandler));
postsRouter.post("/posts/:id/select-variation", requireUserId, asyncHandler(selectVariationHandler));
postsRouter.post("/posts/:id/feedback", requireUserId, asyncHandler(postFeedbackHandler));
