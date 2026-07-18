import assert from "node:assert/strict";
import test from "node:test";

import {
  formatGeminiOutput,
  GeminiProvider,
  OpenAIProvider,
  SearchLimitError,
} from "../src/ai-provider.js";

const commonInput = {
  systemPrompt: "Be concise.",
  username: "alice",
  prompt: "What is this?",
  images: [{ url: "https://cdn.example/image.png", contentType: "image/png" }],
  continuationId: "previous-id",
  useWebSearch: true,
};

test("OpenAI provider maps the common request to the Responses API", async () => {
  let request;
  const client = {
    responses: {
      create: async (value) => {
        request = value;
        return { id: "openai-id", output_text: " OpenAI answer " };
      },
    },
  };
  const provider = new OpenAIProvider({
    model: "openai-model",
    reasoningEffort: "medium",
    client,
  });

  const result = await provider.generate(commonInput);
  assert.deepEqual(result, { text: "OpenAI answer", continuationId: "openai-id" });
  assert.equal(request.previous_response_id, "previous-id");
  assert.deepEqual(request.reasoning, { effort: "medium" });
  assert.equal(request.input[0].content[1].image_url, "https://cdn.example/image.png");
  assert.equal(request.tools[0].type, "web_search");
});

test("Gemini provider maps the common request to the Interactions API", async () => {
  let request;
  const client = {
    interactions: {
      create: async (value) => {
        request = value;
        return { id: "gemini-id", output_text: " Gemini answer ", steps: [] };
      },
    },
  };
  const provider = new GeminiProvider({
    model: "gemini-model",
    thinkingLevel: "medium",
    googleSearchEnabled: true,
    client,
  });

  const result = await provider.generate(commonInput);
  assert.deepEqual(result, { text: "Gemini answer", continuationId: "gemini-id" });
  assert.equal(request.system_instruction, "Be concise.");
  assert.equal(request.previous_interaction_id, "previous-id");
  assert.deepEqual(request.generation_config, { thinking_level: "medium" });
  assert.deepEqual(request.tools, [{ type: "google_search" }]);
  assert.deepEqual(request.input[1], {
    type: "image",
    uri: "https://cdn.example/image.png",
    mime_type: "image/png",
  });
});

test("Gemini output inserts inline citations and removes exact duplicates", () => {
  const interaction = {
    output_text: "unused",
    steps: [
      {
        type: "model_output",
        content: [
          {
            type: "text",
            text: "Alpha beta.",
            annotations: [
              { type: "url_citation", endIndex: 5, title: "Source", url: "https://example.com" },
              { type: "url_citation", endIndex: 5, title: "Source", url: "https://example.com" },
            ],
          },
        ],
      },
    ],
  };

  assert.equal(formatGeminiOutput(interaction), "Alpha [Source](https://example.com) beta.");
});

test("Gemini output falls back to output_text when no text blocks exist", () => {
  assert.equal(formatGeminiOutput({ output_text: " answer ", steps: [] }), "answer");
});

test("Gemini output converts UTF-8 byte citation offsets for Japanese text", () => {
  const interaction = {
    steps: [
      {
        type: "model_output",
        content: [
          {
            type: "text",
            text: "日本の天気",
            annotations: [
              {
                type: "url_citation",
                end_index: Buffer.byteLength("日本", "utf8"),
                title: "Weather",
                url: "https://example.com/weather",
              },
            ],
          },
        ],
      },
    ],
  };

  assert.equal(
    formatGeminiOutput(interaction),
    "日本 [Weather](https://example.com/weather)の天気",
  );
});

test("Gemini search quota errors are not retried as ungrounded requests", async () => {
  let calls = 0;
  const provider = new GeminiProvider({
    model: "gemini-model",
    googleSearchEnabled: true,
    client: {
      interactions: {
        create: async () => {
          calls += 1;
          const error = new Error("RESOURCE_EXHAUSTED: quota exceeded");
          error.status = 429;
          throw error;
        },
      },
    },
  });

  await assert.rejects(() => provider.generate(commonInput), SearchLimitError);
  assert.equal(calls, 1);
});
