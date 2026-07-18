import assert from "node:assert/strict";
import test from "node:test";

import { getWebSearchDecision } from "../src/web-search.js";

test("blocks search-intent prompts before the Gemini API when grounding is disabled", () => {
  const decision = getWebSearchDecision({
    prompt: "今日の天気を調べて",
    webSearchEnabled: true,
    provider: { name: "gemini", googleSearchEnabled: false },
  });
  assert.equal(decision, "unavailable");
});

test("enables supported search and leaves ordinary prompts ungrounded", () => {
  assert.equal(
    getWebSearchDecision({
      prompt: "最新ニュース",
      webSearchEnabled: true,
      provider: { name: "gemini", googleSearchEnabled: true },
    }),
    "enabled",
  );
  assert.equal(
    getWebSearchDecision({
      prompt: "hello",
      webSearchEnabled: true,
      provider: { name: "gemini", googleSearchEnabled: false },
    }),
    "disabled",
  );
});
