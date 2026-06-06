# Discord ChatGPT Bot

A minimal Discord bot that lets people chat with OpenAI from Discord. In servers, the bot replies only when mentioned. In DMs, it replies to normal messages.

## Requirements

- Node.js 20 or newer
- Discord bot token
- OpenAI API key

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

This bot is a long-running Node.js process that connects outbound to Discord and OpenAI. It does not need an inbound HTTP port.

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
OPENAI_API_KEY=your_openai_api_key
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

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `OPENAI_API_KEY` | Yes | OpenAI API key |
| `OPENAI_MODEL` | No | OpenAI model. Default: `gpt-5.2` |
| `BOT_SYSTEM_PROMPT` | No | System instructions for the bot |
| `ALLOWED_CHANNEL_IDS` | No | Comma-separated Discord channel IDs. Leave empty to allow all channels |
| `CONVERSATION_TIMEOUT_MINUTES` | No | Minutes before a user's conversation context resets. Default: `60` |

## Conversation Memory

The bot keeps conversation context in memory per server/channel/user while the process is running.

- Context resets automatically after `CONVERSATION_TIMEOUT_MINUTES` minutes of inactivity.
- Context also resets when the bot process restarts.
- Mention the bot with `reset`, `リセット`, or `忘れて` to reset your own context in that channel.
- Reset commands do not affect other users or other channels.

## Notes

This bot uses the OpenAI Responses API through the official OpenAI JavaScript SDK.

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
