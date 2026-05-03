import { getUserId } from "../middlewares/authenticate.js";
import { env } from "../config/env.js";
import { extractInsights } from "../helpers/extractInsights.js";
import { startGenerateDraftJob, AiServiceError } from "../services/aiClient.service.js";
import { persistGeneratedFromCallback } from "../services/posts.service.js";
import { apiErrorBody } from "../utils/response.js";
import { generateCompleteCallbackSchema, generateTweetBodySchema } from "../validations/ai.validations.js";

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
  const topicForGeneration = effectiveTopicForMocks(parsed.data.topic, rework);
  const tones = /** @type {[string, string]} */ (parsed.data.tones);
  try {
    const started = await startGenerateDraftJob(
      env,
      {
        topic: topicForGeneration,
        tones,
        profession: null,
        audience: null,
        vibe: null,
        rework_base_text: rework?.base ?? null,
        rework_instructions: rework?.instructions ?? null,
        user_id: null,
        model_provider: parsed.data.modelProvider ?? null,
        model_name: parsed.data.modelName ?? null,
      },
      req.requestId,
    );
    req.log.info({ requestId: req.requestId, workerRequestId: started.requestId }, "generation accepted by ai service");
    return res.status(202).json({
      ok: true,
      status: "started",
      requestId: started.requestId,
      message: "We started working on your post.",
      insights: extractInsights(topicForGeneration, tones.join(", ")),
    });
  } catch (e) {
    if (e instanceof AiServiceError) {
      return res.status(e.statusCode).json(apiErrorBody(e.code, e.message));
    }
    throw e;
  }
}

export async function generateTweetHandlerPersist(req, res) {
  const parsed = generateTweetBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid request", parsed.error.flatten()));
  }
  const userId = getUserId(req);
  const rework = reworkFromBody(parsed.data);
  const tones = /** @type {[string, string]} */ (parsed.data.tones);
  const topicForGeneration = effectiveTopicForMocks(parsed.data.topic, rework);
  try {
    const started = await startGenerateDraftJob(env, {
      topic: topicForGeneration,
      tones,
      profession: null,
      audience: null,
      vibe: null,
      rework_base_text: rework?.base ?? null,
      rework_instructions: rework?.instructions ?? null,
      user_id: userId,
      model_provider: parsed.data.modelProvider ?? null,
      model_name: parsed.data.modelName ?? null,
    }, req.requestId);
    req.log.info(
      {
        requestId: req.requestId,
        userId,
        workerRequestId: started.requestId,
      },
      "generation accepted by ai service",
    );
    return res.status(202).json({
      ok: true,
      status: "started",
      requestId: started.requestId,
      message: "We started working on your post.",
      insights: extractInsights(topicForGeneration, tones.join(", ")),
    });
  } catch (e) {
    if (e instanceof AiServiceError) {
      return res.status(e.statusCode).json(apiErrorBody(e.code, e.message));
    }
    throw e;
  }
}

export async function generateCompleteCallbackHandler(req, res) {
  const parsed = generateCompleteCallbackSchema.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      {
        requestId: req.requestId,
        issues: parsed.error.flatten(),
      },
      "callback_invalid_payload",
    );
    return res.status(400).json(apiErrorBody("VALIDATION_ERROR", "Invalid callback payload", parsed.error.flatten()));
  }

  const payload = parsed.data;
  if (payload.status === "succeeded") {
    const callbackUserId = payload.meta?.userId ?? null;
    const callbackTopic = payload.meta?.topic ?? "";
    const callbackTones = Array.isArray(payload.meta?.tones) ? payload.meta.tones : [];
    const callbackVariations = Array.isArray(payload.result?.variations) ? payload.result.variations : [];
    if (!payload.result.postId && callbackUserId && callbackVariations.length >= 2) {
      try {
        const persisted = await persistGeneratedFromCallback(
          callbackUserId,
          callbackTopic,
          callbackTones,
          callbackVariations,
          typeof payload.result?.model === "string" ? payload.result.model : null,
        );
        payload.result.postId = persisted.postId;
      } catch (err) {
        req.log.error({ err, requestId: req.requestId }, "callback_persist_generated_post_failed");
      }
    }
    req.log.info(
      {
        requestId: req.requestId,
        workerRequestId: payload.requestId,
        status: payload.status,
        hasResult: true,
        finishedAt: payload.finishedAt,
        sourceUserId: payload.meta?.userId ?? null,
        sourceRequestId: payload.meta?.sourceRequestId ?? null,
        tones: payload.meta?.tones ?? null,
      },
      "callback_success_received",
    );
  } else {
    req.log.info(
      {
        requestId: req.requestId,
        workerRequestId: payload.requestId,
        status: payload.status,
        hasResult: Boolean(payload.result),
        errorCode: payload.error.code,
        errorMessage: payload.error.message,
        errorStage: payload.error.stage ?? "unknown",
        finishedAt: payload.finishedAt,
        sourceUserId: payload.meta?.userId ?? null,
        sourceRequestId: payload.meta?.sourceRequestId ?? null,
        tones: payload.meta?.tones ?? null,
      },
      "callback_failed_received",
    );
  }
  const io = req.app?.locals?.io;
  if (io && typeof io.to === "function") {
    let socketPayload = payload;
    if (payload.status === "succeeded" && payload.result && "pipeline" in payload.result) {
      const { pipeline: _pipeline, ...resultRest } = payload.result;
      socketPayload = { ...payload, result: resultRest };
    }
    io.to(`generation:${payload.requestId}`).emit("generation_lifecycle", socketPayload);
  }
  return res.status(202).json({ ok: true });
}
