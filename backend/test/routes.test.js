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
      .send({ topic: "ab" })
      .expect(400);
    assert.equal(res.body.error.code, "VALIDATION_ERROR");
  });

  test("POST /ai/generate rejects rework instructions without base draft", async () => {
    const res = await request(app)
      .post("/ai/generate")
      .set("content-type", "application/json")
      .send({
        topic: "Launch week for our new feature",
        tone: "concise",
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
        tone: "concise",
        reworkBaseText: "Some draft text here for the mock.",
        reworkInstructions: "Make it shorter please.",
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
