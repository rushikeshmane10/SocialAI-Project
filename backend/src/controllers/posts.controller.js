import { getUserId } from "../middlewares/authenticate.js";
import * as postsService from "../services/posts.service.js";
import { processFeedback } from "../services/feedback.service.js";
import { apiErrorBody } from "../utils/response.js";
import { listPostsQuerySchema, selectVariationBodySchema } from "../validations/posts.validations.js";
import { postFeedbackBodySchema } from "../validations/feedback.validations.js";

function mapPost(row) {
  return {
    id: row.id,
    topic: row.topic,
    tone: row.tone,
    generatedText: row.generated_text,
    imagePrompt: row.image_prompt,
    imageUrl: row.image_url,
    status: row.status,
    publishedAt: row.published_at,
    selectedVariationId: row.selected_variation_id ?? null,
    selectedText: row.selected_text ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPostsHandler(req, res) {
  const parsed = listPostsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid query", parsed.error.flatten()));
  }
  const userId = getUserId(req);
  const rows = await postsService.listPostsForUser(userId, parsed.data.limit, parsed.data.offset);
  return res.json({
    posts: rows.map((r) => mapPost(r)),
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });
}

export async function getPostByIdHandler(req, res) {
  const userId = getUserId(req);
  const { id } = req.params;
  const row = await postsService.getPostForUser(userId, id);
  if (!row) {
    return res.status(404).json(apiErrorBody("NOT_FOUND", "Post not found"));
  }
  return res.json(mapPost(row));
}

export async function selectVariationHandler(req, res) {
  const parsed = selectVariationBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid request", parsed.error.flatten()));
  }
  const userId = getUserId(req);
  const { id: postId } = req.params;
  try {
    const result = await postsService.selectVariation(
      userId,
      postId,
      /** @type {1 | 2} */ (parsed.data.variation_id),
      parsed.data.selected_text,
    );
    if (!result.ok) {
      const code = result.code;
      if (code === "NOT_FOUND") {
        return res.status(404).json(apiErrorBody("NOT_FOUND", "Post not found"));
      }
      if (code === "ALREADY_SELECTED" || code === "INVALID_STATE") {
        return res.status(409).json(apiErrorBody(code, "Post cannot be updated in this state"));
      }
      const bad400 = {
        VARIATION_MISMATCH: "Selected text does not match this variation",
        INVALID_POST: "This post does not support variation picking",
        INVALID_VARIATION: "variation_id must be 1 or 2",
      };
      return res.status(400).json(
        apiErrorBody(
          result.code ?? "BAD_REQUEST",
          bad400[/** @type {keyof typeof bad400} */ (result.code)] ?? "Invalid selection",
        ),
      );
    }
    return res.json({
      success: true,
      postId: result.postId,
      selectedVariation: result.selectedVariation,
    });
  } catch (e) {
    req.log.error({ err: e }, "select variation failed");
    return res.status(500).json(apiErrorBody("INTERNAL_ERROR", "Could not save selection"));
  }
}

export async function postFeedbackHandler(req, res) {
  const parsed = postFeedbackBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid request", parsed.error.flatten()));
  }
  const userId = getUserId(req);
  const { id: postId } = req.params;
  try {
    const result = await processFeedback({
      postId,
      userId,
      action: parsed.data.action,
      editedText: parsed.data.editedText,
      metadata: parsed.data.metadata,
    });
    if (!result.ok) {
      return res.status(404).json(apiErrorBody("NOT_FOUND", "Post not found"));
    }
    return res.json({ ok: true });
  } catch (e) {
    req.log.error({ err: e }, "feedback transaction failed");
    return res.status(500).json(apiErrorBody("INTERNAL_ERROR", "Could not save feedback"));
  }
}
