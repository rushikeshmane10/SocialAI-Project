import { getModels, getSequelize } from "../db/sequelize.js";
import { computeDynamicAdjustments } from "./behaviorLearner.service.js";

/**
 * Recompute `user_profiles.dynamic_adjustments` from recent feedback (shared by feedback + variation pick).
 * @param {string} userId
 * @param {import('sequelize').Transaction} transaction
 */
export async function refreshProfileFromRecentFeedback(userId, transaction) {
  const { PostFeedback, UserProfile } = getModels();
  const recentRows = await PostFeedback.findAll({
    where: { user_id: userId },
    order: [["created_at", "DESC"]],
    limit: 20,
    attributes: ["action"],
    raw: true,
    transaction,
  });
  const recent = recentRows.map((r) => r.action);
  const adjustments = computeDynamicAdjustments(recent);
  await UserProfile.update(
    { dynamic_adjustments: adjustments },
    { where: { user_id: userId }, transaction },
  );
}

/**
 * @param {object} input
 * @param {string} input.postId
 * @param {string} input.userId
 * @param {'accepted' | 'rejected' | 'edited' | 'regenerated'} input.action
 * @param {string | null | undefined} input.editedText
 * @param {Record<string, unknown>} [input.metadata]
 */
export async function processFeedback(input) {
  const sequelize = getSequelize();
  const { Post, PostFeedback, UserProfile } = getModels();
  const meta = input.metadata ?? {};

  return sequelize.transaction(async (transaction) => {
    const post = await Post.findOne({
      where: { id: input.postId },
      transaction,
    });
    if (!post || post.user_id !== input.userId) {
      return { ok: false, code: "NOT_FOUND" };
    }

    if (input.action === "edited") {
      const text = (input.editedText ?? "").trim();
      const [n] = await Post.update(
        { generated_text: text },
        { where: { id: input.postId, user_id: input.userId }, transaction },
      );
      if (!n) return { ok: false, code: "NOT_FOUND" };
    }
    if (input.action === "accepted") {
      const updates = { status: "published", published_at: new Date() };
      const [n] = await Post.update(updates, {
        where: { id: input.postId, user_id: input.userId },
        transaction,
      });
      if (!n) return { ok: false, code: "NOT_FOUND" };
    }
    if (input.action === "rejected") {
      const [n] = await Post.update(
        { status: "rejected" },
        { where: { id: input.postId, user_id: input.userId }, transaction },
      );
      if (!n) return { ok: false, code: "NOT_FOUND" };
    }

    await PostFeedback.create(
      {
        post_id: input.postId,
        user_id: input.userId,
        action: input.action,
        edited_text: input.action === "edited" ? (input.editedText ?? null) : null,
        metadata: meta,
      },
      { transaction },
    );

    await refreshProfileFromRecentFeedback(input.userId, transaction);

    return { ok: true };
  });
}
