export class AiServiceError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   * @param {string} code
   */
  constructor(message, statusCode, code) {
    super(message);
    this.name = "AiServiceError";
    this.statusCode = statusCode;
    this.code = code;
  }
}


/**
 * Parse Python async-start response.
 * @param {unknown} json
 */
export function parseGenerateStartResponse(json) {
  if (!json || typeof json !== "object") {
    throw new AiServiceError("AI service returned invalid body", 502, "AI_UPSTREAM");
  }
  const o = /** @type {{ accepted?: unknown; request_id?: unknown }} */ (json);
  if (o.accepted !== true || typeof o.request_id !== "string" || o.request_id.trim().length < 1) {
    throw new AiServiceError("AI service returned invalid acknowledgement", 502, "AI_UPSTREAM");
  }
  return { requestId: o.request_id.trim() };
}

function parseImageResult(value) {
  if (!value || typeof value !== "object") {
    return { status: "skipped", code: "IMAGE_NOT_REQUESTED", message: "Image generation is not required for text drafts." };
  }
  const o = value;
  const status = o.status === "ok" || o.status === "failed" || o.status === "skipped" ? o.status : null;
  if (!status) {
    return { status: "skipped", code: "IMAGE_NOT_REQUESTED", message: "Image generation is not required for text drafts." };
  }
  const model = typeof o.model === "string" ? o.model : undefined;
  const code = typeof o.code === "string" ? o.code : undefined;
  const message = typeof o.message === "string" ? o.message : undefined;
  return { status, model, code, message };
}

/** Parses Python pipeline JSON; exported for tests. */
export function parseGeneratePipelineResponse(json) {
  if (!json || typeof json !== "object") {
    throw new AiServiceError("AI service returned invalid body", 502, "AI_UPSTREAM");
  }
  const o = json;
  const postRaw = typeof o.post === "string" ? o.post : typeof o.draft === "string" ? o.draft : null;
  if (typeof postRaw !== "string" || postRaw.trim().length === 0) {
    throw new AiServiceError("AI service response missing post", 502, "AI_UPSTREAM");
  }

  const image_prompt =
    o.image_prompt === null || o.image_prompt === undefined
      ? null
      : typeof o.image_prompt === "string"
        ? o.image_prompt
        : null;

  const image_url =
    o.image_url === null || o.image_url === undefined
      ? null
      : typeof o.image_url === "string"
        ? o.image_url
        : null;

  const image = parseImageResult(o.image);
  const model = typeof o.model === "string" ? o.model : undefined;

  return {
    post: postRaw,
    image_prompt,
    image_url,
    image,
    model,
  };
}

/**
 * Trigger async generation and return request id acknowledgement.
 * @param {any} env
 * @param {{
 *   topic: string;
 *   tones: [string, string];
 *   profession?: string | null;
 *   audience?: string | null;
 *   vibe?: string | null;
 *   rework_base_text?: string | null;
 *   rework_instructions?: string | null;
 *   user_id?: string | null;
 *   model_provider?: string | null;
 *   model_name?: string | null;
 * }} input
 * @param {string} requestId
 */
export async function startGenerateDraftJob(env, input, requestId) {
  const url = new URL("/generate-async", env.AI_SERVICE_URL).toString();
  const controller = new AbortController();
  const timeoutMs = env.AI_SERVICE_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        topic: input.topic,
        tones: input.tones,
        profession: input.profession ?? null,
        audience: input.audience ?? null,
        vibe: input.vibe ?? null,
        rework_base_text: input.rework_base_text ?? null,
        rework_instructions: input.rework_instructions ?? null,
        user_id: input.user_id ?? null,
        model_provider: input.model_provider ?? null,
        model_name: input.model_name ?? null,
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new AiServiceError("AI service returned invalid JSON", 502, "AI_UPSTREAM");
    }

    if (!res.ok) {
      const detailMessage =
        typeof json === "object" && json !== null && "detail" in json
          ? Array.isArray(json.detail)
            ? json.detail
                .map((item) =>
                  item && typeof item === "object" && "msg" in item && typeof item.msg === "string"
                    ? item.msg
                    : null,
                )
                .filter(Boolean)
                .join("; ")
            : typeof json.detail === "string"
              ? json.detail
              : ""
          : "";

      if (res.status === 422 || res.status === 400) {
        throw new AiServiceError(detailMessage || "Invalid request for generation", 400, "VALIDATION_ERROR");
      }
      if (res.status === 504 || res.status === 408) {
        throw new AiServiceError(detailMessage || "Generation timed out", 504, "AI_TIMEOUT");
      }
      throw new AiServiceError(detailMessage || "AI service error", 502, "AI_UPSTREAM");
    }

    return parseGenerateStartResponse(json);
  } catch (e) {
    if (e instanceof AiServiceError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new AiServiceError("Generation timed out", 504, "AI_TIMEOUT");
    }
    throw new AiServiceError("Could not reach AI service", 502, "AI_UPSTREAM");
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateDraft(env, input, requestId) {
  const url = new URL("/generate", env.AI_SERVICE_URL).toString();
  const controller = new AbortController();
  const timeoutMs = env.AI_SERVICE_GENERATE_TIMEOUT_MS;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({
        topic: input.topic,
        tone: input.tone,
        profession: input.profession,
        audience: input.audience,
        vibe: input.vibe,
        rework_base_text: input.rework_base_text,
        rework_instructions: input.rework_instructions,
      }),
      signal: controller.signal,
    });

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      throw new AiServiceError("AI service returned invalid JSON", 502, "AI_UPSTREAM");
    }

    if (!res.ok) {
      if (res.status === 422) {
        throw new AiServiceError("Invalid topic for generation", 400, "VALIDATION_ERROR");
      }
      if (res.status === 504 || res.status === 408) {
        throw new AiServiceError("Generation timed out", 504, "AI_TIMEOUT");
      }
      const msg =
        typeof json === "object" &&
        json !== null &&
        "detail" in json &&
        typeof json.detail === "string"
          ? json.detail
          : "AI service error";
      throw new AiServiceError(msg, res.status >= 500 ? 502 : 502, "AI_UPSTREAM");
    }

    return parseGeneratePipelineResponse(json);
  } catch (e) {
    if (e instanceof AiServiceError) throw e;
    if (e instanceof Error && e.name === "AbortError") {
      throw new AiServiceError("Generation timed out", 504, "AI_TIMEOUT");
    }
    throw new AiServiceError("Could not reach AI service", 502, "AI_UPSTREAM");
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate one draft per tone and return stable variation objects.
 * @param {any} env
 * @param {{
 *   topic: string;
 *   tones: [string, string];
 *   profession?: string | null;
 *   audience?: string | null;
 *   vibe?: string | null;
 *   rework_base_text?: string | null;
 *   rework_instructions?: string | null;
 * }} input
 * @param {string} requestId
 */
export async function generateDraftVariations(env, input, requestId) {
  const [tone1, tone2] = input.tones;
  const base = {
    topic: input.topic,
    profession: input.profession ?? null,
    audience: input.audience ?? null,
    vibe: input.vibe ?? null,
    rework_base_text: input.rework_base_text ?? null,
    rework_instructions: input.rework_instructions ?? null,
  };
  const [r1, r2] = await Promise.all([
    generateDraft(env, { ...base, tone: tone1 }, `${requestId}-tone-1`),
    generateDraft(env, { ...base, tone: tone2 }, `${requestId}-tone-2`),
  ]);

  return {
    variations: [
      {
        variation_id: 1,
        text: r1.post.trim(),
        tone_applied: tone1,
        estimated_length: `${[...r1.post.trim()].length} chars`,
        hashtags: [],
      },
      {
        variation_id: 2,
        text: r2.post.trim(),
        tone_applied: tone2,
        estimated_length: `${[...r2.post.trim()].length} chars`,
        hashtags: [],
      },
    ],
    models: [r1.model ?? null, r2.model ?? null],
  };
}
