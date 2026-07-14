import { env } from "../config/env.js";
import { postTweet, TwitterServiceError } from "../services/twitter.service.js";
import { apiErrorBody } from "../utils/response.js";
import { postTweetBodySchema } from "../validations/ai.validations.js";

export async function postTweetHandler(req, res) {
  const parsed = postTweetBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid request", parsed.error.flatten()));
  }

  try {
    const result = await postTweet(env, parsed.data.text);
    return res.json(result);
  } catch (e) {
    if (e instanceof TwitterServiceError) {
      return res.status(e.statusCode).json(apiErrorBody(e.code, e.message));
    }
    throw e;
  }
}
