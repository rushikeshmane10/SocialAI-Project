import * as profileService from "./profile.service.js";

/**
 * Reads onboarding answers from `user_profiles` (empty strings if no row).
 * @param {string} userId
 * @returns {Promise<{ profession: string; audience: string; vibe: string }>}
 */
export async function getPreferencesAnswers(userId) {
  const row = await profileService.getProfile(userId);
  if (!row) {
    return { profession: "", audience: "", vibe: "" };
  }
  return {
    profession: String(row.profession ?? "").trim(),
    audience: String(row.audience ?? "").trim(),
    vibe: String(row.vibe ?? "").trim(),
  };
}

/**
 * Maps questionnaire answers into user_profiles (profession, audience, vibe).
 * @param {string} userId
 * @param {Record<string, string>} answers
 */
export async function savePreferencesAnswers(userId, answers) {
  const profession = String(answers.profession ?? "").trim();
  const audience = String(answers.audience ?? "").trim();
  const vibe = String(answers.vibe ?? "").trim();
  return profileService.upsertProfile(userId, { profession, audience, vibe });
}
