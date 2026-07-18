# Discord AI Bot

**English** | [日本語](README.ja.md)

A minimal Discord bot that lets people chat with OpenAI or Gemini. Select the provider at startup with an environment variable. In servers, the bot replies only when mentioned. In DMs, it replies to normal messages.

## Requirements

- Node.js 20 or newer
- Discord bot token
- OpenAI API key or Gemini API key

## Setup

1. Install dependencies.

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill in your keys.

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

3. In the Discord Developer Portal, create a bot and enable:

- A bot token
- Privileged Gateway Intents: `Message Content Intent`
- OAuth2 URL Generator: `bot` scope
- Bot permissions: `View Channels`, `Send Messages`, `Read Message History`

4. Start the bot.

```bash
npm start
```

## Deploy to a Google Cloud VM

This bot is a long-running Node.js process that connects outbound to Discord and the selected AI provider. It does not need an inbound HTTP port.

These commands assume an Ubuntu/Debian VM, `systemd`, and deployment to `/opt/discord-chatgpt-bot`.

1. SSH into the VM and install Node.js 20 or newer, npm, and git.

```bash
node --version
npm --version
git --version
```

If `node --version` is lower than `v20`, upgrade Node.js before continuing.

2. Clone the repository.

```bash
sudo mkdir -p /opt/discord-chatgpt-bot
sudo chown "$USER":"$USER" /opt/discord-chatgpt-bot
git clone <your-repository-url> /opt/discord-chatgpt-bot
cd /opt/discord-chatgpt-bot
```

3. Install dependencies.

```bash
npm install
```

4. Create the production environment file.

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

Set at least:

```env
DISCORD_TOKEN=your_discord_bot_token
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
```

To use Gemini instead:

```env
DISCORD_TOKEN=your_discord_bot_token
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash
```

5. Test the bot once manually.

```bash
npm start
```

Stop it with `Ctrl+C` after you see `Logged in as ...`.

6. Install and start the `systemd` service.

```bash
sudo cp deploy/discord-chatgpt-bot.service /etc/systemd/system/discord-chatgpt-bot.service
sudo systemctl daemon-reload
sudo systemctl enable discord-chatgpt-bot
sudo systemctl start discord-chatgpt-bot
```

7. Check service status and logs.

```bash
sudo systemctl status discord-chatgpt-bot
journalctl -u discord-chatgpt-bot -f
```

To update the bot later:

```bash
cd /opt/discord-chatgpt-bot
git pull
npm install
sudo systemctl restart discord-chatgpt-bot
```

## Usage

Mention the bot in a server:

```text
@YourBot hello, help me plan today
```

In DMs, send a message without mentioning it.

You can attach images with a mention or in a DM and ask questions about them:

```text
@YourBot what is shown in this image?
```

If you send only an image in a DM or with a mention, the bot asks the selected provider to describe the image.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `AI_PROVIDER` | No | `openai` or `gemini`. Default: `openai` |
| `OPENAI_API_KEY` | For OpenAI | OpenAI API key |
| `OPENAI_MODEL` | No | OpenAI model. Default: `gpt-5.6-terra` |
| `OPENAI_REASONING_EFFORT` | No | Reasoning effort: `none`, `low`, `medium`, `high`, `xhigh`, or `max`. Unset or empty uses the model default |
| `GEMINI_API_KEY` | For Gemini | Gemini API key |
| `GEMINI_MODEL` | No | Gemini model. Default: `gemini-3.5-flash` |
| `GEMINI_THINKING_LEVEL` | No | Thinking level: `minimal`, `low`, `medium`, or `high`. Unset or empty uses the model default |
| `GEMINI_GOOGLE_SEARCH_ENABLED` | No | Send the Gemini `google_search` tool. Enable only for a supported model and billing tier. Default: `false` |
| `BOT_SYSTEM_PROMPT` | No | System instructions for the bot |
| `ALLOWED_CHANNEL_IDS` | No | Comma-separated Discord channel IDs. Leave empty to allow all channels |
| `CONVERSATION_TIMEOUT_MINUTES` | No | Minutes before a channel's shared conversation context resets. Default: `60` |
| `WEB_SEARCH_ENABLED` | No | Enable web search for messages that look like they need current information. Default: `true` |

## Reasoning Effort

Set `OPENAI_REASONING_EFFORT` to control the balance between response speed, cost, and reasoning quality. The example configuration uses `medium`:

```env
OPENAI_REASONING_EFFORT=medium
```

Use `none` for the lowest-latency baseline, or increase the value when a task benefits from more reasoning. Supported values for the default `gpt-5.6-terra` model are `none`, `low`, `medium`, `high`, `xhigh`, and `max`. If the variable is unset or empty, the bot omits `reasoning.effort` and uses the selected model's default. An unsupported value stops the bot at startup with a configuration error.

## Gemini Thinking Level

Set `GEMINI_THINKING_LEVEL` to control Gemini reasoning. The example configuration uses `medium`:

```env
GEMINI_THINKING_LEVEL=medium
```

Supported configuration values are `minimal`, `low`, `medium`, and `high`. Model support varies; the Gemini API rejects a level that is not supported by the selected model. If the variable is unset or empty, the bot uses the model default.

## Web Search

The bot only sends a search tool when a message appears to need current information.

Web search is enabled when `WEB_SEARCH_ENABLED` is not `false`, `0`, `off`, or `no`, and the prompt contains one of these keywords:

```text
最新 ニュース 調べて 検索 現在 今日 価格 天気 公式
```

Normal messages are sent without a search tool. OpenAI uses `web_search` when the global setting is enabled.

Gemini additionally requires `GEMINI_GOOGLE_SEARCH_ENABLED=true`. Keep it `false` when Google Search grounding is unavailable for the selected model or billing tier, including the Gemini 3.5 Flash free tier. When a message looks like it needs search while this setting is false, the bot does not call Gemini and explains that web search is unavailable. It does not fall back to an ungrounded answer.

When Gemini search is enabled, citation annotations are inserted into the response as Discord Markdown links. Quota and rate-limit failures return an explicit error and are not retried without grounding.

## Conversation Memory

The bot keeps one shared conversation context in memory per channel while the process is running. In a server channel, messages from every user who mentions the bot and the bot's replies become part of the same context. Messages that do not mention the bot are not added. DMs and Discord threads each have their own context.

- Context resets automatically after `CONVERSATION_TIMEOUT_MINUTES` minutes of inactivity.
- Context also resets when the bot process restarts.
- Mention the bot with `reset`, `リセット`, or `忘れて` to reset the shared context for that channel.
- Any user can reset the channel's shared context. Reset commands do not affect other channels.

## Notes

This bot uses the OpenAI Responses API or the Gemini Interactions API through their official JavaScript SDKs. The provider is fixed for the lifetime of the bot process.

OpenAI image input supports JPEG, PNG, WebP, and GIF attachments. Gemini image input supports JPEG, PNG, and WebP; GIF is rejected with an explanatory message. Each message can include up to 4 images, and each image must be 20 MB or smaller.

Image input consumes provider API usage. Non-image attachments such as PDFs are ignored when text is present.

Gemini Interactions are stored server-side by default so `previous_interaction_id` can continue a conversation. Discord reset commands remove only the bot's local continuation ID; they do not delete stored Interactions from Google.

On a VM, keep `.env` out of git and restrict its permissions because it contains secret tokens.

## Troubleshooting

If `npm start` fails with `SyntaxError: Unexpected token '?'`, the VM is running an old Node.js version. Check it with:

```bash
node --version
```

Install Node.js 20 or newer, reinstall dependencies, and restart the bot:

```bash
cd /opt/discord-chatgpt-bot
npm install
npm start
```

If the bot is managed by `systemd`, restart the service after upgrading Node.js:

```bash
sudo systemctl restart discord-chatgpt-bot
journalctl -u discord-chatgpt-bot -f
```
