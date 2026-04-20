import { getUserId } from "../middlewares/authenticate.js";
import * as preferencesService from "../services/preferences.service.js";
import { apiErrorBody } from "../utils/response.js";
import { preferencesLogBodySchema } from "../validations/preferences.validations.js";

export async function getPreferencesHandler(req, res) {
  const userId = getUserId(req);
  try {
    const answers = await preferencesService.getPreferencesAnswers(userId);
    return res.json({ answers });
  } catch (err) {
    req.log?.error({ err, userId }, "preferences fetch failed");
    return res
      .status(503)
      .json(apiErrorBody("SERVICE_UNAVAILABLE", "Could not load preferences. Try again later."));
  }
}

export async function logPreferencesHandler(req, res) {
  const parsed = preferencesLogBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid request", parsed.error.flatten()));
  }
  const userId = getUserId(req);
  try {
    await preferencesService.savePreferencesAnswers(userId, parsed.data.answers);
  } catch (err) {
    req.log?.error({ err, userId }, "preferences save failed");
    return res
      .status(503)
      .json(apiErrorBody("SERVICE_UNAVAILABLE", "Could not save preferences. Try again later."));
  }
  req.log.info({
    event: "preferences_saved",
    userId,
  });
  return res.json({ ok: true });
}
