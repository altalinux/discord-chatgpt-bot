# Discord AI Bot

[English](README.md) | **日本語**

OpenAI、Gemini、Sarashina と会話できる、最小構成の Discord bot です。起動時に環境変数で使用するプロバイダーを選択します。サーバーでは bot がメンションされた場合のみ返信し、DM では通常のメッセージに返信します。

## 必要なもの

- Node.js 20 以降
- Discord bot トークン
- OpenAI API キーまたは Gemini API キー

## セットアップ

1. 依存関係をインストールします。

```bash
npm install
```

2. `.env.example` を `.env` にコピーし、キーを設定します。

```bash
cp .env.example .env
```

PowerShell の場合:

```powershell
Copy-Item .env.example .env
```

3. Discord Developer Portal で bot を作成し、次の項目を有効にします。

- Bot token
- Privileged Gateway Intents: `Message Content Intent`
- OAuth2 URL Generator: `bot` スコープ
- Bot permissions: `View Channels`、`Send Messages`、`Read Message History`

4. bot を起動します。

```bash
npm start
```

## Google Cloud VM へのデプロイ

この bot は Discord と選択した AI プロバイダーに外向き接続する、長時間稼働する Node.js プロセスです。受信用の HTTP ポートは必要ありません。

以下のコマンドは、Ubuntu/Debian VM、`systemd`、`/opt/discord-chatgpt-bot` へのデプロイを前提としています。

1. VM に SSH 接続し、Node.js 20 以降、npm、git をインストールします。

```bash
node --version
npm --version
git --version
```

`node --version` が `v20` 未満の場合は、続行する前に Node.js をアップグレードしてください。

2. リポジトリをクローンします。

```bash
sudo mkdir -p /opt/discord-chatgpt-bot
sudo chown "$USER":"$USER" /opt/discord-chatgpt-bot
git clone <your-repository-url> /opt/discord-chatgpt-bot
cd /opt/discord-chatgpt-bot
```

3. 依存関係をインストールします。

```bash
npm install
```

4. 本番用の環境変数ファイルを作成します。

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

少なくとも次を設定します。

```env
DISCORD_TOKEN=your_discord_bot_token
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
```

Gemini を使う場合:

```env
DISCORD_TOKEN=your_discord_bot_token
AI_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.5-flash
```

5. bot を手動で一度テストします。

```bash
npm start
```

`Logged in as ...` と表示されたら `Ctrl+C` で停止します。

6. `systemd` サービスをインストールして起動します。

```bash
sudo cp deploy/discord-chatgpt-bot.service /etc/systemd/system/discord-chatgpt-bot.service
sudo systemctl daemon-reload
sudo systemctl enable discord-chatgpt-bot
sudo systemctl start discord-chatgpt-bot
```

7. サービスの状態とログを確認します。

```bash
sudo systemctl status discord-chatgpt-bot
journalctl -u discord-chatgpt-bot -f
```

後で bot を更新する場合:

```bash
cd /opt/discord-chatgpt-bot
git pull
npm install
sudo systemctl restart discord-chatgpt-bot
```

## 使い方

サーバーで bot をメンションします。

```text
@YourBot hello, help me plan today
```

DM では、メンションなしでメッセージを送ります。

画像をメンションまたは DM に添付して、画像について質問することもできます。

```text
@YourBot what is shown in this image?
```

DM またはメンションと一緒に画像だけを送ると、選択したプロバイダーに画像の説明を依頼します。

## 環境変数

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `DISCORD_TOKEN` | はい | Discord bot トークン |
| `AI_PROVIDER` | いいえ | `openai`、`gemini`、`sarashina`。デフォルト: `openai` |
| `OPENAI_API_KEY` | OpenAI 使用時 | OpenAI API キー |
| `OPENAI_MODEL` | いいえ | OpenAI モデル。デフォルト: `gpt-5.6-terra` |
| `OPENAI_REASONING_EFFORT` | いいえ | 推論の強さ: `none`、`low`、`medium`、`high`、`xhigh`、`max`。未設定または空の場合はモデルのデフォルトを使用 |
| `GEMINI_API_KEY` | Gemini 使用時 | Gemini API キー |
| `GEMINI_MODEL` | いいえ | Gemini モデル。デフォルト: `gemini-3.5-flash` |
| `GEMINI_THINKING_LEVEL` | いいえ | 思考レベル: `minimal`、`low`、`medium`、`high`。未設定または空の場合はモデルのデフォルトを使用 |
| `GEMINI_GOOGLE_SEARCH_ENABLED` | いいえ | Gemini の `google_search` ツールを送信。対応モデルと課金プランでのみ有効にしてください。デフォルト: `false` |
| `BOT_SYSTEM_PROMPT` | いいえ | bot のシステム指示 |
| `ALLOWED_CHANNEL_IDS` | いいえ | Discord チャンネル ID のカンマ区切り。空の場合はすべてのチャンネルを許可 |
| `CONVERSATION_TIMEOUT_MINUTES` | いいえ | チャンネルの共有会話コンテキストをリセットするまでの無操作時間（分）。デフォルト: `60` |
| `WEB_SEARCH_ENABLED` | いいえ | 最新情報が必要と思われるメッセージでウェブ検索を有効化。デフォルト: `true` |

## 推論の強さ

`OPENAI_REASONING_EFFORT` で、応答速度・コスト・推論品質のバランスを調整できます。サンプル設定では `medium` を使用しています。

```env
OPENAI_REASONING_EFFORT=medium
```

最低遅延の基準値には `none` を使い、より深い推論が必要なタスクでは値を上げます。デフォルトの `gpt-5.6-terra` モデルで使用できる値は `none`、`low`、`medium`、`high`、`xhigh`、`max` です。未設定または空の場合、bot は `reasoning.effort` を省略し、選択したモデルのデフォルトを使用します。サポートされていない値を指定すると、設定エラーで起動が停止します。

## Gemini の思考レベル

`GEMINI_THINKING_LEVEL` で Gemini の推論を調整できます。サンプル設定では `medium` を使用しています。

```env
GEMINI_THINKING_LEVEL=medium
```

設定できる値は `minimal`、`low`、`medium`、`high` です。モデルによって対応状況が異なるため、選択したモデルが対応していないレベルを指定すると Gemini API に拒否されます。未設定または空の場合はモデルのデフォルトを使用します。

## ウェブ検索

bot は、メッセージに最新情報が必要と思われる場合にのみ検索ツールを送信します。

`WEB_SEARCH_ENABLED` が `false`、`0`、`off`、`no` のいずれでもなく、プロンプトに次のキーワードのいずれかが含まれる場合にウェブ検索が有効になります。

```text
最新 ニュース 調べて 検索 現在 今日 価格 天気 公式
```

通常のメッセージには検索ツールを付けずに送信します。OpenAI では、全体設定が有効な場合に `web_search` を使用します。

Gemini では、さらに `GEMINI_GOOGLE_SEARCH_ENABLED=true` が必要です。選択したモデルまたは課金プランで Google Search grounding が利用できない場合（Gemini 3.5 Flash の無料プランを含む）は `false` のままにしてください。この設定が `false` の状態で検索が必要なメッセージを受け取ると、bot は Gemini を呼び出さず、ウェブ検索が利用できないことを説明します。grounding なしの回答へはフォールバックしません。

Gemini の検索が有効な場合、引用アノテーションは Discord Markdown リンクとして応答に挿入されます。クォータ超過やレート制限のエラーは明示的に返され、grounding なしで再試行されることはありません。

## 会話メモリ

bot は、プロセスの実行中、チャンネルごとに共有会話コンテキストをメモリ上に保持します。サーバーのチャンネルでは、bot をメンションしたすべてのユーザーのメッセージと bot の返信が同じコンテキストに追加されます。bot がメンションされていないメッセージは追加されません。DM と Discord スレッドにはそれぞれ固有のコンテキストがあります。

- `CONVERSATION_TIMEOUT_MINUTES` 分間操作がないと、自動的にリセットされます。
- bot のプロセスを再起動してもリセットされます。
- `reset`、`リセット`、または `忘れて` と bot をメンションすると、そのチャンネルの共有コンテキストをリセットできます。
- チャンネルの共有コンテキストは誰でもリセットできます。リセットコマンドは他のチャンネルには影響しません。

## 注意事項

この bot は、公式 JavaScript SDK を通じて OpenAI Responses API または Gemini Interactions API を使用します。プロバイダーは bot プロセスの実行中は固定されます。

OpenAI の画像入力は JPEG、PNG、WebP、GIF の添付ファイルに対応しています。Gemini の画像入力は JPEG、PNG、WebP に対応し、GIF は説明付きのメッセージを返して拒否されます。1 メッセージにつき最大 4 枚まで画像を含められ、各画像は 20 MB 以下である必要があります。

画像入力はプロバイダー API の使用量を消費します。PDF など画像以外の添付ファイルは、テキストがある場合は無視されます。

Gemini Interactions はデフォルトでサーバー側に保存されるため、`previous_interaction_id` によって会話を継続できます。Discord のリセットコマンドが削除するのは bot 内部の継続 ID のみで、Google に保存された Interactions は削除されません。

VM 上では `.env` を git の管理対象外にし、秘密トークンが含まれるため権限を制限してください。

## トラブルシューティング

`npm start` の実行時に `SyntaxError: Unexpected token '?'` が発生する場合、VM 上の Node.js が古いバージョンです。次のコマンドで確認してください。

```bash
node --version
```

Node.js 20 以降をインストールし、依存関係を再インストールして bot を再起動します。

```bash
cd /opt/discord-chatgpt-bot
npm install
npm start
```


## Sarashinaで雑談する

Sarashina APIコンソールでキーを発行し、次を`.env`に設定して再起動します。

```dotenv
AI_PROVIDER=sarashina
SARASHINA_API_KEY=your_sarashina_api_key
SARASHINA_MODEL=sarashina3-mini
BOT_SYSTEM_PROMPT=あなたは「ぐもっぴー」です。親しみやすい日本語で会話してください。
CONVERSATION_TIMEOUT_MINUTES=60
```

SarashinaはChat Completions APIを使用します。通常1〜3文で回答する指示を付け、出力上限512トークン、temperature 0.7で呼び出します。生成中はDiscordの入力中表示を出し、完成した回答を投稿します。

会話本文はチャンネル・DMごとに直近6往復だけメモリに保持します。`CONVERSATION_TIMEOUT_MINUTES`分の無操作、リセットコマンド、プロセス再起動で消えます。成功してDiscordに投稿できた会話だけを追加します。OpenAI・Geminiの継続IDによる会話管理は従来どおりです。

画像には新ぐもっぴーを使うよう案内します。Sarashinaには検索ツールを送信せず、`WEB_SEARCH_ENABLED`が有効でも検索しません。最新情報を確認できない旨をシステム指示に含めます。

公開ベータの制限に合わせ、このプロセス全体で直近60秒に最大6回だけAPIを呼びます。上限では残りの待ち時間を案内するので、待ってからもう一度話しかけてください。APIが429を返した場合は60秒間呼び出しを休止します。自動再試行は行わず、1回の通信は最大60秒でタイムアウトします。同じ契約で別のプロセスも動かす場合、その利用分はローカルの回数管理には含まれません。

公式仕様: https://docs.sarashina.ai/api-reference/chat-completions
