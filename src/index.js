import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import OpenAI from "openai";

const {
  DISCORD_TOKEN,
  OPENAI_API_KEY,
  OPENAI_MODEL = "gpt-5.2",
  BOT_SYSTEM_PROMPT = "You are a helpful assistant chatting in Discord. Keep replies friendly and concise.",
  ALLOWED_CHANNEL_IDS = "",
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
  const previousResponseId = conversations.get(conversationKey);

  try {
    await message.channel.sendTyping();

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      instructions: BOT_SYSTEM_PROMPT,
      tools: [
        {
          type: "web_search",
          search_context_size: "medium",
        },
      ],
      tool_choice: "auto",
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
    });

    conversations.set(conversationKey, response.id);

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
