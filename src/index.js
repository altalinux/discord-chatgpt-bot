import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import OpenAI from "openai";

const {
  DISCORD_TOKEN,
  OPENAI_API_KEY,
  OPENAI_MODEL = "gpt-5.2",
  BOT_SYSTEM_PROMPT = "You are a helpful assistant chatting in Discord. Keep replies friendly and concise.",
  ALLOWED_CHANNEL_IDS = "",
  CONVERSATION_TIMEOUT_MINUTES = "60",
  WEB_SEARCH_ENABLED = "true",
} = process.env;

if (!DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN is required. Add it to your .env file.");
}

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is required. Add it to your .env file.");
}

const allowedChannelIds = new Set(
  ALLOWED_CHANNEL_IDS.split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const conversations = new Map();
const MAX_DISCORD_MESSAGE_LENGTH = 2000;
const RESET_COMMANDS = new Set(["reset", "リセット", "忘れて"]);
const WEB_SEARCH_KEYWORDS = ["最新", "ニュース", "調べて", "検索", "現在", "今日", "価格", "天気", "公式"];
const conversationTimeoutMs = parseConversationTimeout(CONVERSATION_TIMEOUT_MINUTES) * 60 * 1000;
const webSearchEnabled = parseBoolean(WEB_SEARCH_ENABLED);

discord.once("ready", () => {
  console.log(`Logged in as ${discord.user.tag}`);
});

discord.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.guild && allowedChannelIds.size > 0 && !allowedChannelIds.has(message.channelId)) return;

  const isDirectMessage = !message.guild;
  const wasMentioned = message.mentions.has(discord.user);

  if (!isDirectMessage && !wasMentioned) return;

  const prompt = cleanPrompt(message.content, discord.user.id);

  if (!prompt) {
    await message.reply("What would you like to talk about?");
    return;
  }

  const conversationKey = `${message.guildId ?? "dm"}:${message.channelId}:${message.author.id}`;

  if (isResetCommand(prompt)) {
    conversations.delete(conversationKey);
    await message.reply("Conversation history reset.");
    return;
  }

  const conversation = conversations.get(conversationKey);
  const previousResponseId =
    conversation && !isConversationExpired(conversation) ? conversation.responseId : undefined;

  if (conversation && !previousResponseId) {
    conversations.delete(conversationKey);
  }

  try {
    await message.channel.sendTyping();

    const request = {
      model: OPENAI_MODEL,
      instructions: BOT_SYSTEM_PROMPT,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${message.author.username}: ${prompt}`,
            },
          ],
        },
      ],
      previous_response_id: previousResponseId,
    };

    if (shouldUseWebSearch(prompt)) {
      request.tools = [
        {
          type: "web_search",
          search_context_size: "medium",
        },
      ];
      request.tool_choice = "auto";
    }

    const response = await openai.responses.create(request);

    conversations.set(conversationKey, {
      responseId: response.id,
      lastUsedAt: Date.now(),
    });

    const reply = response.output_text?.trim() || "Sorry, I could not generate a reply.";
    for (const chunk of splitForDiscord(reply)) {
      await message.reply(chunk);
    }
  } catch (error) {
    console.error(error);
    await message.reply("An error occurred. Please check the bot logs.");
  }
});

discord.login(DISCORD_TOKEN);

function cleanPrompt(content, botUserId) {
  return content.replaceAll(`<@${botUserId}>`, "").replaceAll(`<@!${botUserId}>`, "").trim();
}

function isResetCommand(prompt) {
  return RESET_COMMANDS.has(prompt.toLowerCase());
}

function shouldUseWebSearch(prompt) {
  return webSearchEnabled && WEB_SEARCH_KEYWORDS.some((keyword) => prompt.includes(keyword));
}

function isConversationExpired(conversation) {
  return Date.now() - conversation.lastUsedAt > conversationTimeoutMs;
}

function parseConversationTimeout(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("CONVERSATION_TIMEOUT_MINUTES must be a positive number.");
  }

  return parsed;
}

function parseBoolean(value) {
  return !["false", "0", "off", "no"].includes(value.trim().toLowerCase());
}

function splitForDiscord(text) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > MAX_DISCORD_MESSAGE_LENGTH) {
    const slice = remaining.slice(0, MAX_DISCORD_MESSAGE_LENGTH);
    const splitAt = Math.max(slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
    const chunkEnd = splitAt > 1000 ? splitAt : MAX_DISCORD_MESSAGE_LENGTH;

    chunks.push(remaining.slice(0, chunkEnd).trim());
    remaining = remaining.slice(chunkEnd).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}
