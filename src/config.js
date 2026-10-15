import { parseReasoningEffort } from "./reasoning-effort.js";
import { parseThinkingLevel } from "./thinking-level.js";

const SUPPORTED_AI_PROVIDERS = new Set(["openai", "gemini", "sarashina"]);

export function loadConfig(env = process.env) {
  const aiProvider = (env.AI_PROVIDER || "openai").trim().toLowerCase();

  if (!SUPPORTED_AI_PROVIDERS.has(aiProvider)) {
    throw new Error("AI_PROVIDER must be openai, gemini, or sarashina.");
  }

  requireValue(env.DISCORD_TOKEN, "DISCORD_TOKEN");

  if (aiProvider === "openai") {
    requireValue(env.OPENAI_API_KEY, "OPENAI_API_KEY");
  } else if (aiProvider === "sarashina") {
    requireValue(env.SARASHINA_API_KEY, "SARASHINA_API_KEY");
  } else {
    requireValue(env.GEMINI_API_KEY, "GEMINI_API_KEY");
  }

  return {
    discordToken: env.DISCORD_TOKEN,
    aiProvider,
    sarashinaApiKey: env.SARASHINA_API_KEY,
    sarashinaModel: env.SARASHINA_MODEL || "sarashina3-mini",
    openaiApiKey: env.OPENAI_API_KEY,
    openaiModel: env.OPENAI_MODEL || "gpt-5.6-terra",
    openaiReasoningEffort:
      aiProvider === "openai" ? parseReasoningEffort(env.OPENAI_REASONING_EFFORT) : undefined,
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL || "gemini-3.5-flash",
    geminiThinkingLevel:
      aiProvider === "gemini" ? parseThinkingLevel(env.GEMINI_THINKING_LEVEL) : undefined,
    geminiGoogleSearchEnabled:
      aiProvider === "gemini"
        ? parseBoolean(
            env.GEMINI_GOOGLE_SEARCH_ENABLED ?? "false",
            "GEMINI_GOOGLE_SEARCH_ENABLED",
          )
        : false,
    botSystemPrompt:
      env.BOT_SYSTEM_PROMPT ||
      "You are a helpful assistant chatting in Discord. Keep replies friendly and concise.",
    allowedChannelIds: new Set(
      (env.ALLOWED_CHANNEL_IDS || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
    conversationTimeoutMs:
      parsePositiveNumber(env.CONVERSATION_TIMEOUT_MINUTES ?? "60", "CONVERSATION_TIMEOUT_MINUTES") *
      60 *
      1000,
    webSearchEnabled: parseBoolean(env.WEB_SEARCH_ENABLED ?? "true", "WEB_SEARCH_ENABLED"),
  };
}

function requireValue(value, name) {
  if (!value?.trim()) {
    throw new Error(`${name} is required. Add it to your .env file.`);
  }
}

function parsePositiveNumber(value, name) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }

  return parsed;
}

export function parseBoolean(value, name) {
  const normalized = value.trim().toLowerCase();

  if (["true", "1", "on", "yes"].includes(normalized)) return true;
  if (["false", "0", "off", "no"].includes(normalized)) return false;
  throw new Error(`${name} must be a boolean value.`);
}
