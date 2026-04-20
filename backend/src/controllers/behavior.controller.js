import { getModels } from "../db/sequelize.js";
import { getUserId } from "../middlewares/authenticate.js";
import { apiErrorBody } from "../utils/response.js";
import { behaviorEventBodySchema } from "../validations/behavior.validations.js";

export async function postBehaviorEventHandler(req, res) {
  const parsed = behaviorEventBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid request", parsed.error.flatten()));
  }
  const userId = getUserId(req);
  const { UserBehavior } = getModels();
  await UserBehavior.create({
    user_id: userId,
    event_type: parsed.data.event_type,
    payload: parsed.data.payload,
  });
  return res.json({ ok: true });
}
