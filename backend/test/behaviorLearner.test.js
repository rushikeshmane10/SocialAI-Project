import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { computeDynamicAdjustments } from "../src/services/behaviorLearner.service.js";

describe("computeDynamicAdjustments", () => {
  test("high edit rate sets conciseness hint", () => {
    const actions = Array(10).fill("edited");
    const out = computeDynamicAdjustments(actions);
    const hints = out.hints;
    assert.equal(hints.conciseness, "prefer_shorter");
  });

  test("high accept rate sets reinforce hint", () => {
    const actions = Array(10).fill("accepted");
    const out = computeDynamicAdjustments(actions);
    const hints = out.hints;
    assert.equal(hints.reinforce, "current_style_ok");
  });
});
