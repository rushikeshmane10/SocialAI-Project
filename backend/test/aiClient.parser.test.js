import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AiServiceError, parseGeneratePipelineResponse } from "../src/services/aiClient.service.js";

describe("parseGeneratePipelineResponse", () => {
  test("parses full success payload", () => {
    const out = parseGeneratePipelineResponse({
      post: "Hello world",
      image_prompt: "A sunny meadow",
      image_url: "https://example.com/i.png",
      image: { status: "ok", model: "dall-e-3" },
      model: "gpt-4o-mini",
    });
    assert.equal(out.post, "Hello world");
    assert.equal(out.image_prompt, "A sunny meadow");
    assert.equal(out.image_url, "https://example.com/i.png");
    assert.equal(out.image.status, "ok");
    assert.equal(out.image.model, "dall-e-3");
    assert.equal(out.model, "gpt-4o-mini");
  });

  test("accepts draft as post fallback", () => {
    const out = parseGeneratePipelineResponse({
      draft: "Legacy",
      image_prompt: null,
      image_url: null,
      image: { status: "failed", code: "X", message: "Y" },
      model: "m",
    });
    assert.equal(out.post, "Legacy");
  });

  test("throws when post missing", () => {
    assert.throws(
      () =>
        parseGeneratePipelineResponse({
          image_prompt: null,
          image_url: null,
          image: { status: "failed" },
        }),
      AiServiceError,
    );
  });
});
