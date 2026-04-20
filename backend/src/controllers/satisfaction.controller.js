import { getUserId } from "../middlewares/authenticate.js";
import { recordSatisfactionSignal } from "../services/satisfaction.service.js";
import { apiErrorBody } from "../utils/response.js";
import { satisfactionBodySchema } from "../validations/satisfaction.validations.js";

export async function postSatisfactionHandler(req, res) {
  const parsed = satisfactionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid request", parsed.error.flatten()));
  }

  const userId = getUserId(req);
  const { id: postId } = req.params;
  try {
    const result = await recordSatisfactionSignal(userId, postId, parsed.data.signal);
    if (result.duplicate) {
      return res.status(200).json({ success: true, signal: result.signal, duplicate: true });
    }
    return res.status(201).json({
      success: true,
      signal_id: result.signal_id,
      signal: result.signal,
    });
  } catch (e) {
    const status = /** @type {Error & { statusCode?: number }} */ (e).statusCode;
    if (status === 404) {
      return res.status(404).json(apiErrorBody("NOT_FOUND", e.message || "Post not found"));
    }
    if (status === 400) {
      return res.status(400).json(apiErrorBody("INVALID_STATE", e.message || "Invalid state"));
    }
    throw e;
  }
}
