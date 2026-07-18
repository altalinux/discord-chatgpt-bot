import "dotenv/config";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { createAiProvider, SearchLimitError } from "./ai-provider.js";
import { loadConfig } from "./config.js";
import { ChannelConversationManager, getConversationKey } from "./conversation-context.js";
import { splitForDiscord } from "./discord-text.js";
import { getImageAttachments, validateImageAttachments } from "./image-attachments.js";
import { getWebSearchDecision } from "./web-search.js";

const config = loadConfig();
const {
  discordToken,
  botSystemPrompt,
  allowedChannelIds,
  conversationTimeoutMs,
  webSearchEnabled,
} = config;
const aiProvider = createAiProvider(config);

const discord = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

const RESET_COMMANDS = new Set(["reset", "リセット", "忘れて"]);
const conversationManager = new ChannelConversationManager({ timeoutMs: conversationTimeoutMs });

discord.once("ready", () => {
  console.log(
    `Logged in as ${discord.user.tag} using ${aiProvider.name}/${aiProvider.model}` +
      (aiProvider.name === "gemini"
        ? ` (Google Search: ${aiProvider.googleSearchEnabled ? "enabled" : "disabled"})`
        : ""),
  );
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
  const imageValidationError = validateImageAttachments(imageAttachments, aiProvider);

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
      const searchDecision = getWebSearchDecision({ prompt, webSearchEnabled, provider: aiProvider });

      if (searchDecision === "unavailable") {
        await message.reply(
          "Web search is not available with the current Gemini configuration. " +
            "Please rephrase the question so it does not require current information, " +
            "or enable Google Search for a supported billing configuration.",
        );
        return;
      }

      const response = await aiProvider.generate({
        systemPrompt: botSystemPrompt,
        username: message.author.username,
        prompt,
        images: imageAttachments,
        continuationId: conversationManager.getContinuationId(conversationKey),
        useWebSearch: searchDecision === "enabled",
      });
      conversationManager.setContinuationId(conversationKey, response.continuationId);
      const reply = response.text || "Sorry, I could not generate a reply.";
      for (const chunk of splitForDiscord(reply)) {
        await message.reply(chunk);
      }
    } catch (error) {
      console.error(error);
      await message.reply(
        error instanceof SearchLimitError
          ? "Web search is temporarily unavailable because its quota or rate limit was reached."
          : "An error occurred. Please check the bot logs.",
      );
    }
  });
});

discord.login(discordToken);

function cleanPrompt(content, botUserId) {
  return content.replaceAll(`<@${botUserId}>`, "").replaceAll(`<@!${botUserId}>`, "").trim();
}

function isResetCommand(prompt) {
  return RESET_COMMANDS.has(prompt.toLowerCase());
}
