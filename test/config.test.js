import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig, parseBoolean } from "../src/config.js";

const baseEnv = { DISCORD_TOKEN: "discord-token" };

test("defaults to OpenAI and only requires the selected provider key", () => {
  const config = loadConfig({ ...baseEnv, OPENAI_API_KEY: "openai-key" });
  assert.equal(config.aiProvider, "openai");
  assert.equal(config.openaiModel, "gpt-5.6-terra");
  assert.equal(config.geminiGoogleSearchEnabled, false);
  assert.throws(() => loadConfig(baseEnv), /OPENAI_API_KEY is required/);
});

test("ignores Gemini-only search configuration when OpenAI is selected", () => {
  for (const value of ["", "not-a-boolean"]) {
    const config = loadConfig({
      ...baseEnv,
      OPENAI_API_KEY: "openai-key",
      GEMINI_GOOGLE_SEARCH_ENABLED: value,
    });
    assert.equal(config.geminiGoogleSearchEnabled, false);
  }
});

test("selects Gemini without requiring an OpenAI key", () => {
  const config = loadConfig({
    ...baseEnv,
    AI_PROVIDER: " GEMINI ",
    GEMINI_API_KEY: "gemini-key",
  });
  assert.equal(config.aiProvider, "gemini");
  assert.equal(config.geminiModel, "gemini-3.5-flash");
  assert.equal(config.geminiGoogleSearchEnabled, false);
  assert.throws(
    () => loadConfig({ ...baseEnv, AI_PROVIDER: "gemini" }),
    /GEMINI_API_KEY is required/,
  );
});

test("rejects invalid provider, boolean, and selected-provider reasoning settings", () => {
  assert.throws(
    () => loadConfig({ ...baseEnv, AI_PROVIDER: "other", OPENAI_API_KEY: "key" }),
    /AI_PROVIDER must be/,
  );
  assert.throws(() => parseBoolean("maybe", "FLAG"), /FLAG must be a boolean value/);
  assert.throws(
    () =>
      loadConfig({
        ...baseEnv,
        AI_PROVIDER: "gemini",
        GEMINI_API_KEY: "key",
        GEMINI_GOOGLE_SEARCH_ENABLED: "",
      }),
    /GEMINI_GOOGLE_SEARCH_ENABLED must be a boolean value/,
  );
  assert.throws(
    () =>
      loadConfig({
        ...baseEnv,
        AI_PROVIDER: "gemini",
        GEMINI_API_KEY: "key",
        GEMINI_THINKING_LEVEL: "maximum",
      }),
    /GEMINI_THINKING_LEVEL must be one of/,
  );
});
