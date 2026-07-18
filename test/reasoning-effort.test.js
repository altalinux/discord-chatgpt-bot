import assert from "node:assert/strict";
import test from "node:test";

import { parseReasoningEffort } from "../src/reasoning-effort.js";

test("accepts every supported reasoning effort", () => {
  for (const effort of ["none", "low", "medium", "high", "xhigh", "max"]) {
    assert.equal(parseReasoningEffort(effort), effort);
  }
});

test("normalizes reasoning effort case and whitespace", () => {
  assert.equal(parseReasoningEffort("  XHIGH  "), "xhigh");
});

test("returns undefined when reasoning effort is unset or empty", () => {
  assert.equal(parseReasoningEffort(undefined), undefined);
  assert.equal(parseReasoningEffort("   "), undefined);
});

test("rejects unsupported reasoning effort", () => {
  assert.throws(
    () => parseReasoningEffort("minimal"),
    /OPENAI_REASONING_EFFORT must be one of: none, low, medium, high, xhigh, max\./,
  );
});
