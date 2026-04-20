import { getModels, getSequelize } from "../db/sequelize.js";
import { extractInsights } from "../helpers/extractInsights.js";
import { mockGenerate } from "../helpers/mockGenerate.js";
import { refreshProfileFromRecentFeedback } from "./feedback.service.js";

const MOCK_GENERATED_VERSION = 1;

/**
 * Parse persisted mock payload from posts.generated_text.
 * @param {string} generatedText
 * @returns {Array<{ variation_id: number; text: string }> | null}
 */
export function parseStoredVariations(generatedText) {
  try {
    const data = JSON.parse(generatedText);
    if (data && Array.isArray(data.variations)) return data.variations;
  } catch {
    return null;
  }
  return null;
}

/**
 * @param {{ base: string; instructions: string } | null} rework
 */
function effectiveTopicForPersist(topic, rework) {
  const t = (topic ?? "").trim();
  if (!rework || rework.instructions.length < 3) return t;
  const block = `—\nBase draft:\n${rework.base}\n\nEditor notes:\n${rework.instructions}`;
  return `${t}\n\n${block}`.slice(0, 450);
}

/**
 * Mock AI path: insights → behavior row → 2 variations → draft post (JSON in generated_text).
 * @param {string} userId
 * @param {string} topic
 * @param {string} [tone]
 * @param {{ base: string; instructions: string } | null} [rework]
 * @param {{ sourcePostId?: string | null; sourceVariationId?: number | null }} [options]
 */
export async function mockGenerateAndPersist(userId, topic, tone, rework = null, options = {}) {
  const sequelize = getSequelize();
  const { Post, UserBehavior, PostReworkLog } = getModels();
  const topicForMocks = effectiveTopicForPersist(topic, rework);
  const insights = extractInsights(topicForMocks, tone ?? "");
  if (process.env.NODE_ENV === "development") {
    console.log("[generate insights]", insights);
  }
  const variations = mockGenerate(topicForMocks, tone ?? "", insights);
  const generated_text = JSON.stringify({ version: MOCK_GENERATED_VERSION, variations });

  return sequelize.transaction(async (transaction) => {
    await UserBehavior.create(
      {
        user_id: userId,
        event_type: "generate_insight",
        payload: { ...insights, topic, tone: tone ?? "", rework: Boolean(rework?.instructions) },
      },
      { transaction },
    );

    const post = await Post.create(
      {
        user_id: userId,
        topic,
        tone: tone?.trim() ? tone.trim() : null,
        generated_text,
        image_prompt: null,
        image_url: null,
        status: "draft",
      },
      { transaction },
    );

    if (rework) {
      let sourcePostId = options.sourcePostId ?? null;
      if (sourcePostId) {
        const src = await Post.findOne({
          where: { id: sourcePostId, user_id: userId },
          transaction,
        });
        if (!src) sourcePostId = null;
      }

      const vid = options.sourceVariationId === 1 || options.sourceVariationId === 2 ? options.sourceVariationId : null;

      await PostReworkLog.create(
        {
          user_id: userId,
          source_post_id: sourcePostId,
          result_post_id: post.id,
          base_draft_text: rework.base,
          user_instructions: rework.instructions,
          source_variation_id: vid,
          model_output: {
            version: MOCK_GENERATED_VERSION,
            variations,
            insights,
            topic: (topic ?? "").trim(),
            tone: tone?.trim() ? tone.trim() : null,
            source_variation_id: vid,
          },
        },
        { transaction },
      );
    }

    return { postId: post.id, variations, insights };
  });
}

/**
 * User picked one mock variation: update post, log behavior + feedback, refresh profile hints.
 * @param {string} userId
 * @param {string} postId
 * @param {1 | 2} variationId
 * @param {string} selectedText
 */
export async function selectVariation(userId, postId, variationId, selectedText) {
  const sequelize = getSequelize();
  const { Post, UserBehavior, PostFeedback } = getModels();
  const text = (selectedText ?? "").trim();

  return sequelize.transaction(async (transaction) => {
    const post = await Post.findOne({
      where: { id: postId, user_id: userId },
      transaction,
    });
    if (!post) {
      return { ok: false, code: "NOT_FOUND" };
    }
    if (post.status === "selected" && post.selected_variation_id != null) {
      return { ok: false, code: "ALREADY_SELECTED" };
    }

    const variations = parseStoredVariations(post.generated_text);
    if (!variations || variations.length !== 2) {
      return { ok: false, code: "INVALID_POST" };
    }
    if (variationId !== 1 && variationId !== 2) {
      return { ok: false, code: "INVALID_VARIATION" };
    }
    const picked = variations.find((v) => v.variation_id === variationId);
    if (!picked || picked.text.trim() !== text) {
      return { ok: false, code: "VARIATION_MISMATCH" };
    }

    const rejected_variation_id = variationId === 1 ? 2 : 1;

    const [n] = await Post.update(
      {
        status: "selected",
        selected_variation_id: variationId,
        selected_text: text,
      },
      { where: { id: postId, user_id: userId, status: "draft" }, transaction },
    );
    if (!n) {
      return { ok: false, code: "INVALID_STATE" };
    }

    await UserBehavior.create(
      {
        user_id: userId,
        event_type: "variation_selected",
        payload: {
          post_id: postId,
          variation_id: variationId,
          selected_text: text,
          rejected_variation_id,
        },
      },
      { transaction },
    );

    await PostFeedback.create(
      {
        post_id: postId,
        user_id: userId,
        action: "accepted",
        edited_text: null,
        metadata: { variation_id: variationId, selection_method: "manual_pick" },
      },
      { transaction },
    );

    await refreshProfileFromRecentFeedback(userId, transaction);

    return { ok: true, postId, selectedVariation: variationId };
  });
}

export async function listPostsForUser(userId, limit, offset) {
  const { Post } = getModels();
  const rows = await Post.findAll({
    where: { user_id: userId },
    order: [
      ["created_at", "DESC"],
      ["id", "DESC"],
    ],
    limit,
    offset,
    raw: true,
  });
  return rows;
}

export async function getPostForUser(userId, postId) {
  const { Post } = getModels();
  const row = await Post.findOne({
    where: { id: postId, user_id: userId },
    raw: true,
  });
  return row ?? null;
}
