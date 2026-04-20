import { getModels } from "../db/sequelize.js";

export async function getProfile(userId) {
  const { UserProfile } = getModels();
  const row = await UserProfile.findOne({ where: { user_id: userId } });
  return row ? row.get({ plain: true }) : null;
}

export async function upsertProfile(userId, fields) {
  const { UserProfile } = getModels();
  const existing = await UserProfile.findOne({ where: { user_id: userId } });
  if (existing) {
    await existing.update({
      profession: fields.profession,
      audience: fields.audience,
      vibe: fields.vibe,
    });
    return existing.get({ plain: true });
  }
  const created = await UserProfile.create({
    user_id: userId,
    profession: fields.profession,
    audience: fields.audience,
    vibe: fields.vibe,
  });
  return created.get({ plain: true });
}
