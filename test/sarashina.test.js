import assert from "node:assert/strict";
import test from "node:test";
import { SarashinaProvider, createAiProvider } from "../src/ai-provider.js";
import { loadConfig } from "../src/config.js";
import { ChannelConversationManager } from "../src/conversation-context.js";
import { RequestLimiter, RateLimitError } from "../src/request-limiter.js";
import { getWebSearchDecision } from "../src/web-search.js";
import { validateImageAttachments } from "../src/image-attachments.js";

const input = { systemPrompt: "ぐもっぴーです。", username: "alice", prompt: "こんにちは" };

test("Sarashina configuration requires only its own key and disables SDK retries", () => {
  assert.throws(() => loadConfig({ DISCORD_TOKEN: "test", AI_PROVIDER: "sarashina" }), /SARASHINA_API_KEY/);
  const config = loadConfig({ DISCORD_TOKEN: "test", AI_PROVIDER: "sarashina", SARASHINA_API_KEY: "test" });
  const provider = createAiProvider(config);
  assert.equal(provider.model, "sarashina3-mini");
  assert.equal(provider.client.baseURL, "https://api.sarashina.ai/v1");
  assert.equal(provider.client.maxRetries, 0);
  assert.equal(provider.client.timeout, 60_000);
});

test("Sarashina sends text history with supported fields only and reads the answer", async () => {
  let request;
  const provider = new SarashinaProvider({ model: "sarashina3-mini", client: {
    chat: { completions: { create: async (value) => {
      request = value;
      return { choices: [{ message: { content: " やっほー！ " } }] };
    } } },
  } });
  const history = [{ role: "user", content: "bob: おはよう" }, { role: "assistant", content: "おはよう！" }];
  assert.deepEqual(await provider.generate({ ...input, history, continuationId: "ignored", useWebSearch: true }), { text: "やっほー！" });
  assert.deepEqual(Object.keys(request).sort(), ["max_completion_tokens", "messages", "model", "temperature"]);
  assert.equal(request.max_completion_tokens, 512);
  assert.match(request.messages[0].content, /ウェブ検索や画像の閲覧はできません/);
  assert.deepEqual(request.messages.slice(1), [...history, { role: "user", content: "alice: こんにちは" }]);
  assert.equal(getWebSearchDecision({ prompt: "今日の天気を検索", webSearchEnabled: true, provider }), "disabled");
  assert.match(validateImageAttachments([{ contentType: "image/png" }], provider), /新ぐもっぴー/);
  assert.equal(validateImageAttachments([], provider), null);
});

test("history keeps six exchanges, isolates channels, expires and resets", () => {
  let now = 100;
  const manager = new ChannelConversationManager({ timeoutMs: 60_000, now: () => now });
  for (let i = 0; i < 7; i++) manager.appendExchange("channel", "alice", `question${i}`, `answer${i}`);
  assert.equal(manager.getHistory("channel").length, 12);
  assert.equal(manager.getHistory("channel")[0].content, "alice: question1");
  assert.deepEqual(manager.getHistory("other"), []);
  const copy = manager.getHistory("channel");
  copy[0].content = "mutated";
  assert.equal(manager.getHistory("channel")[0].content, "alice: question1");
  now += 60_001;
  assert.deepEqual(manager.getHistory("channel"), []);
  manager.appendExchange("channel", "bob", "hi", "hello");
  manager.reset("channel");
  assert.deepEqual(manager.getHistory("channel"), []);
});

test("shared limiter prevents the seventh API call and permits calls after 60 seconds", async () => {
  let now = 0;
  let calls = 0;
  const provider = new SarashinaProvider({ limiter: new RequestLimiter({ now: () => now }), client: {
    chat: { completions: { create: async () => {
      calls++;
      return { choices: [{ message: { content: "hello" } }] };
    } } },
  } });
  await Promise.all(Array.from({ length: 6 }, () => provider.generate(input)));
  now = 10_000;
  await assert.rejects(provider.generate(input), (error) => error instanceof RateLimitError && error.waitSeconds === 50);
  assert.equal(calls, 6);
  now = 60_000;
  await provider.generate(input);
  assert.equal(calls, 7);
});

test("upstream 429 blocks subsequent calls without retrying; empty answers fail", async () => {
  let now = 0;
  let calls = 0;
  const provider = new SarashinaProvider({ limiter: new RequestLimiter({ now: () => now }), client: {
    chat: { completions: { create: async () => {
      calls++;
      if (calls === 1) throw Object.assign(new Error("limited"), { status: 429 });
      return { choices: [] };
    } } },
  } });
  await assert.rejects(provider.generate(input), { status: 429 });
  await assert.rejects(provider.generate(input), RateLimitError);
  assert.equal(calls, 1);
  now = 60_000;
  await assert.rejects(provider.generate(input), /empty answer/);
});
