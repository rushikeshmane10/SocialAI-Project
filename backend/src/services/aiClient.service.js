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

function parseImageResult(value) {
  if (!value || typeof value !== "object") {
    return { status: "failed", code: "INVALID_IMAGE_ENVELOPE", message: "Invalid AI response" };
  }
  const o = value;
  const status = o.status === "ok" || o.status === "failed" ? o.status : null;
  if (!status) {
    return { status: "failed", code: "INVALID_IMAGE_ENVELOPE", message: "Invalid AI response" };
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
      body: JSON.stringify({ topic: input.topic, tone: input.tone }),
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
