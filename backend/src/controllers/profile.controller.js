import { getUserId } from "../middlewares/authenticate.js";
import * as profileService from "../services/profile.service.js";
import { apiErrorBody } from "../utils/response.js";
import { profileUpsertBodySchema } from "../validations/profile.validations.js";

export async function getProfileHandler(req, res) {
  const userId = getUserId(req);
  const profile = await profileService.getProfile(userId);
  if (!profile) {
    return res.status(404).json(apiErrorBody("PROFILE_NOT_FOUND", "Profile not found"));
  }
  return res.json({
    profession: profile.profession,
    audience: profile.audience,
    vibe: profile.vibe,
    dynamic_adjustments: profile.dynamic_adjustments,
    updated_at: profile.updated_at,
  });
}

export async function upsertProfileHandler(req, res) {
  const parsed = profileUpsertBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid request", parsed.error.flatten()));
  }
  const userId = getUserId(req);
  const profile = await profileService.upsertProfile(userId, parsed.data);
  return res.json({
    profession: profile.profession,
    audience: profile.audience,
    vibe: profile.vibe,
    dynamic_adjustments: profile.dynamic_adjustments,
    updated_at: profile.updated_at,
  });
}
