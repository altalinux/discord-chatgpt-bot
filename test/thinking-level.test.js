import assert from "node:assert/strict";
import test from "node:test";

import { parseThinkingLevel } from "../src/thinking-level.js";

test("accepts and normalizes Gemini thinking levels", () => {
  for (const level of ["minimal", "low", "medium", "high"]) {
    assert.equal(parseThinkingLevel(` ${level.toUpperCase()} `), level);
  }
});

test("allows an unset level and rejects unsupported values", () => {
  assert.equal(parseThinkingLevel(undefined), undefined);
  assert.equal(parseThinkingLevel("  "), undefined);
  assert.throws(() => parseThinkingLevel("max"), /GEMINI_THINKING_LEVEL must be one of/);
});
