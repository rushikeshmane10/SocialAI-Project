import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import request from "supertest";
import { createServer } from "../src/createServer.js";

describe("HTTP API", () => {
  /** @type {import('express').Express} */
  let app;

  before(async () => {
    app = await createServer();
  });

  test("GET /health returns ok", async () => {
    const res = await request(app).get("/health").expect(200);
    assert.deepEqual(res.body, { ok: true });
  });

  test("POST /ai/generate validates topic length", async () => {
    const res = await request(app)
      .post("/ai/generate")
      .set("content-type", "application/json")
      .send({ topic: "ab", tones: ["professional", "casual"] })
      .expect(400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  test("POST /ai/generate rejects rework instructions without base draft", async () => {
    const res = await request(app)
      .post("/ai/generate")
      .set("content-type", "application/json")
      .send({
        topic: "Launch week for our new feature",
        tones: ["professional", "casual"],
        reworkInstructions: "Make it shorter and add a question at the end.",
      })
      .expect(400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  test("POST /ai/generate rejects rework without sourceVariationId", async () => {
    const res = await request(app)
      .post("/ai/generate")
      .set("content-type", "application/json")
      .send({
        topic: "Launch week for our new feature",
        tones: ["professional", "casual"],
        reworkBaseText: "Some draft text here for the mock.",
        reworkInstructions: "Make it shorter please.",
      })
      .expect(400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  test("POST /ai/generate rejects invalid modelProvider", async () => {
    const res = await request(app)
      .post("/ai/generate")
      .set("content-type", "application/json")
      .send({
        topic: "Launch week for our new feature",
        tones: ["professional", "casual"],
        modelProvider: "anthropic",
      })
      .expect(400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  test("POST /ai/callback/generate-complete accepts succeeded payload", async () => {
    const res = await request(app)
      .post("/ai/callback/generate-complete")
      .set("content-type", "application/json")
      .send({
        requestId: "cb-success-1",
        status: "succeeded",
        finishedAt: "2026-04-25T13:00:00Z",
        result: {
          postId: null,
          variations: [
            { variation_id: 1, text: "Draft one", tone_applied: "professional", estimated_length: "9 chars", hashtags: [] },
            { variation_id: 2, text: "Draft two", tone_applied: "casual", estimated_length: "9 chars", hashtags: [] },
          ],
        },
        meta: {
          userId: null,
          topic: "Launch day",
          tones: ["professional", "casual"],
          sourceRequestId: "req-1",
        },
      })
      .expect(202);
    assert.deepEqual(res.body, { ok: true });
  });

  test("POST /ai/callback/generate-complete accepts failed payload", async () => {
    const res = await request(app)
      .post("/ai/callback/generate-complete")
      .set("content-type", "application/json")
      .send({
        requestId: "cb-failed-1",
        status: "failed",
        finishedAt: "2026-04-25T13:00:00Z",
        error: {
          code: "LLM_PROVIDER_ERROR",
          message: "Tweet generation failed",
          stage: "tweet",
        },
        meta: {
          userId: null,
          topic: "Launch day",
          tones: ["professional", "casual"],
          sourceRequestId: "req-1",
        },
      })
      .expect(202);
    assert.deepEqual(res.body, { ok: true });
  });

  test("POST /ai/callback/generate-complete rejects malformed status-shape", async () => {
    const res = await request(app)
      .post("/ai/callback/generate-complete")
      .set("content-type", "application/json")
      .send({
        requestId: "cb-bad-1",
        status: "succeeded",
        finishedAt: "2026-04-25T13:00:00Z",
        error: { code: "SHOULD_NOT_BE_HERE", message: "nope" },
      })
      .expect(400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  test("POST /ai/callback/generate-complete rejects missing required fields", async () => {
    const res = await request(app)
      .post("/ai/callback/generate-complete")
      .set("content-type", "application/json")
      .send({
        requestId: "cb-bad-2",
        status: "failed",
        finishedAt: "2026-04-25T13:00:00Z",
      })
      .expect(400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  test("POST /post/tweet validates empty text", async () => {
    await request(app)
      .post("/post/tweet")
      .set("content-type", "application/json")
      .send({ text: "" })
      .expect(400);
  });

  test("POST /post/tweet rejects over 280 chars", async () => {
    await request(app)
      .post("/post/tweet")
      .set("content-type", "application/json")
      .send({ text: "x".repeat(281) })
      .expect(400);
  });

  test("POST /post/tweet returns 503 when Twitter is not configured", async () => {
    const res = await request(app)
      .post("/post/tweet")
      .set("content-type", "application/json")
      .send({ text: "Valid tweet text for configuration test." })
      .expect(503);
    assert.equal(res.body.error.code, "TWITTER_NOT_CONFIGURED");
  });
});
