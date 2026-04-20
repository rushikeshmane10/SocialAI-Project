import { getUserId } from "../middlewares/authenticate.js";
import { extractInsights } from "../helpers/extractInsights.js";
import { mockGenerate } from "../helpers/mockGenerate.js";
import { mockGenerateAndPersist } from "../services/posts.service.js";
import { apiErrorBody } from "../utils/response.js";
import { generateTweetBodySchema } from "../validations/ai.validations.js";

/**
 * @param {string} topic
 * @param {{ base: string; instructions: string } | null} rework
 */
function effectiveTopicForMocks(topic, rework) {
  const t = topic.trim();
  if (!rework || rework.instructions.length < 3) return t;
  const block = `—\nBase draft:\n${rework.base}\n\nEditor notes:\n${rework.instructions}`;
  return `${t}\n\n${block}`.slice(0, 450);
}

function reworkFromBody(body) {
  const ins = (body.reworkInstructions ?? "").trim();
  const base = (body.reworkBaseText ?? "").trim();
  if (ins.length < 3) return null;
  return { base, instructions: ins };
}

export async function generateTweetHandlerLegacy(req, res) {
  const parsed = generateTweetBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid request", parsed.error.flatten()));
  }
  const rework = reworkFromBody(parsed.data);
  const topicForMocks = effectiveTopicForMocks(parsed.data.topic, rework);
  const insights = extractInsights(topicForMocks, parsed.data.tone ?? "");
  if (process.env.NODE_ENV === "development") {
    console.log("[generate insights]", insights);
  }
  const variations = mockGenerate(topicForMocks, parsed.data.tone ?? "", insights);
  return res.json({ postId: null, variations, insights });
}

export async function generateTweetHandlerPersist(req, res) {
  const parsed = generateTweetBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid request", parsed.error.flatten()));
  }
  const userId = getUserId(req);
  const rework = reworkFromBody(parsed.data);
  const result = await mockGenerateAndPersist(userId, parsed.data.topic, parsed.data.tone, rework, {
    sourcePostId: parsed.data.sourcePostId,
    sourceVariationId: parsed.data.sourceVariationId,
  });
  req.log.info(
    {
      requestId: req.requestId,
      userId,
      postId: result.postId,
      keywordCount: result.insights.keywords?.length,
    },
    "mock ai generate completed",
  );
  return res.json(result);
}
