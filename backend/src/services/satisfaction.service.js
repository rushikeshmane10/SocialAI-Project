import { Transaction } from "sequelize";
import { getModels, getSequelize } from "../db/sequelize.js";

/**
 * @param {string} userId
 * @param {string} postId
 * @param {'yes' | 'almost' | 'not_really'} signal
 * @returns {Promise<{ success: true; signal_id?: string; signal: string; duplicate?: boolean }>}
 */
export async function recordSatisfactionSignal(userId, postId, signal) {
  const sequelize = getSequelize();
  const { Post, SatisfactionSignal, UserBehavior, UserProfile } = getModels();

  const existingSignal = await SatisfactionSignal.findOne({
    where: { user_id: userId, post_id: postId },
  });
  if (existingSignal) {
    return { success: true, signal, duplicate: true };
  }

  return sequelize.transaction(async (transaction) => {
      const post = await Post.findOne({
        where: { id: postId, user_id: userId },
        transaction,
        lock: Transaction.LOCK.UPDATE,
      });

      if (!post) {
        const err = new Error("Post not found");
        /** @type {Error & { statusCode?: number }} */ (err).statusCode = 404;
        throw err;
      }

      if (post.status !== "selected" || post.selected_variation_id == null) {
        const err = new Error("Satisfaction is only available after picking a variation");
        /** @type {Error & { statusCode?: number }} */ (err).statusCode = 400;
        /** @type {Error & { code?: string }} */ (err).code = "INVALID_STATE";
        throw err;
      }

      const signaledAt = new Date().toISOString();
      const context = {
        topic: post.topic ?? null,
        tone: post.tone ?? null,
        post_status: post.status ?? null,
        selected_variation_id: post.selected_variation_id ?? null,
        signaled_at: signaledAt,
      };

      const signalRow = await SatisfactionSignal.create(
        {
          post_id: postId,
          user_id: userId,
          signal,
          variation_id: post.selected_variation_id,
          selected_text: post.selected_text,
          context,
        },
        { transaction },
      );

      await UserBehavior.create(
        {
          user_id: userId,
          event_type: "satisfaction_signal",
          payload: {
            post_id: postId,
            signal,
            variation_id: post.selected_variation_id,
            topic: post.topic ?? null,
            tone: post.tone ?? null,
            selected_text: post.selected_text ?? null,
            signal_id: signalRow.id,
          },
        },
        { transaction },
      );

      const profile = await UserProfile.findOne({
        where: { user_id: userId },
        transaction,
        lock: Transaction.LOCK.UPDATE,
      });

      if (profile) {
        const raw = profile.dynamic_adjustments;
        const base = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
        const tally = {
          yes: 0,
          almost: 0,
          not_really: 0,
          ...(base.satisfaction_tally && typeof base.satisfaction_tally === "object"
            ? base.satisfaction_tally
            : {}),
        };
        tally[signal] = (Number(tally[signal]) || 0) + 1;
        const total = tally.yes + tally.almost + tally.not_really;
        const satisfaction_rate = total > 0 ? Math.round((tally.yes / total) * 100) / 100 : null;

        await profile.update(
          {
            dynamic_adjustments: {
              ...base,
              satisfaction_tally: tally,
              satisfaction_rate,
              last_signal: signal,
              last_signal_at: signaledAt,
            },
          },
          { transaction },
        );
      }

      return { success: true, signal_id: signalRow.id, signal };
    });
}
