import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import OpenAI from "openai";
import { ChannelConversationManager, getConversationKey } from "./conversation-context.js";
import { parseReasoningEffort } from "./reasoning-effort.js";

const {
  DISCORD_TOKEN,
  OPENAI_API_KEY,
  OPENAI_MODEL = "gpt-5.6-terra",
  OPENAI_REASONING_EFFORT,
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

const MAX_DISCORD_MESSAGE_LENGTH = 2000;
const MAX_IMAGE_ATTACHMENTS = 4;
const MAX_IMAGE_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const RESET_COMMANDS = new Set(["reset", "リセット", "忘れて"]);
const SUPPORTED_IMAGE_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const WEB_SEARCH_KEYWORDS = ["最新", "ニュース", "調べて", "検索", "現在", "今日", "価格", "天気", "公式"];
const conversationTimeoutMs = parseConversationTimeout(CONVERSATION_TIMEOUT_MINUTES) * 60 * 1000;
const webSearchEnabled = parseBoolean(WEB_SEARCH_ENABLED);
const reasoningEffort = parseReasoningEffort(OPENAI_REASONING_EFFORT);
const conversationManager = new ChannelConversationManager({ timeoutMs: conversationTimeoutMs });

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
  const conversationKey = getConversationKey(message);

  if (isResetCommand(prompt)) {
    await conversationManager.runInOrder(conversationKey, async () => {
      conversationManager.reset(conversationKey);
      await message.reply("Conversation history for this channel has been reset.");
    });
    return;
  }

  const imageAttachments = getImageAttachments(message);
  const imageValidationError = validateImageAttachments(imageAttachments);

  if (imageValidationError) {
    await message.reply(imageValidationError);
    return;
  }

  if (!prompt && imageAttachments.length === 0) {
    await message.reply("What would you like to talk about?");
    return;
  }

  await conversationManager.runInOrder(conversationKey, async () => {
    try {
      await message.channel.sendTyping();
      const request = {
        model: OPENAI_MODEL,
        instructions: BOT_SYSTEM_PROMPT,
        input: [
          {
            role: "user",
            content: buildUserContent(message.author.username, prompt, imageAttachments),
          },
        ],
        previous_response_id: conversationManager.getPreviousResponseId(conversationKey),
        ...(reasoningEffort && { reasoning: { effort: reasoningEffort } }),
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
      conversationManager.setResponseId(conversationKey, response.id);
      const reply = response.output_text?.trim() || "Sorry, I could not generate a reply.";
      for (const chunk of splitForDiscord(reply)) {
        await message.reply(chunk);
      }
    } catch (error) {
      console.error(error);
      await message.reply("An error occurred. Please check the bot logs.");
    }
  });
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

function getImageAttachments(message) {
  return [...message.attachments.values()].filter((attachment) => isImageAttachment(attachment));
}

function isImageAttachment(attachment) {
  return attachment.contentType?.startsWith("image/") || isSupportedImageFilename(attachment.name);
}

function isSupportedImageFilename(filename = "") {
  return /\.(jpe?g|png|webp|gif)$/i.test(filename);
}

function validateImageAttachments(imageAttachments) {
  if (imageAttachments.length > MAX_IMAGE_ATTACHMENTS) {
    return `Please attach up to ${MAX_IMAGE_ATTACHMENTS} images per message.`;
  }

  const unsupportedAttachment = imageAttachments.find(
    (attachment) => !SUPPORTED_IMAGE_CONTENT_TYPES.has(attachment.contentType),
  );

  if (unsupportedAttachment) {
    return "Unsupported image format. Please attach JPEG, PNG, WebP, or GIF images.";
  }

  const oversizedAttachment = imageAttachments.find(
    (attachment) => attachment.size > MAX_IMAGE_ATTACHMENT_BYTES,
  );

  if (oversizedAttachment) {
    return "Each image must be 20 MB or smaller.";
  }

  return null;
}

function buildUserContent(username, prompt, imageAttachments) {
  const text = prompt || "Please describe the attached image.";

  return [
    {
      type: "input_text",
      text: `${username}: ${text}`,
    },
    ...imageAttachments.map((attachment) => ({
      type: "input_image",
      image_url: attachment.url,
      detail: "auto",
    })),
  ];
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
