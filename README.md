# Connpass Discord Bot

ConnpassイベントをDiscordに通知するBot。AIアシスタント機能付き。

## 機能

- **定期通知**: cron式で指定したスケジュールでイベントを自動通知
- **イベント検索**: キーワード、日付、場所で絞り込み
- **AIアシスタント**: Botにメンションして会話形式でイベント検索
- **詳細表示**: ボタンクリックでイベント詳細とAI要約を表示

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

```env
# Discord
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_APPLICATION_ID=your_application_id

# Connpass API
CONNPASS_API_KEY=your_connpass_api_key

# OpenAI（AIアシスタント機能を使う場合）
OPENAI_API_KEY=sk-...

# オプション
JOB_STORE_DIR=./data
ENABLE_AI_AGENT=true
```

### 3. コマンド登録

```bash
pnpm --filter @connpass-discord-bot/discord-bot register
```

### 4. 起動

```bash
# 開発
pnpm --filter @connpass-discord-bot/discord-bot dev

# 本番
pnpm --filter @connpass-discord-bot/discord-bot build
pnpm --filter @connpass-discord-bot/discord-bot start
```

## 使い方

### スラッシュコマンド

| コマンド | 説明 |
|---------|------|
| `/connpass feed set` | フィード設定 |
| `/connpass feed status` | 設定確認 |
| `/connpass feed remove` | フィード削除 |
| `/connpass feed run` | 手動実行 |
| `/connpass user register` | ニックネーム登録 |
| `/connpass today` | 今日のイベント |

### AIアシスタント

Botにメンションして質問：

```
@Bot 来週の東京でのTypeScriptイベントを探して
@Bot 私の今週の予定を教えて
@Bot Feedの設定して
```

## 構成

```
apps/
├── discord-bot/    # Discord Bot本体
└── ai-agent/       # Mastra AIエージェント（参考実装）

packages/
├── core/           # 共通型・インターフェース
└── feed-worker/    # フィード実行・スケジューラー
```

## 技術スタック

- **Runtime**: Node.js 22+
- **Discord**: discord.js
- **AI**: Mastra + OpenAI GPT-4o-mini
- **API**: @kajidog/connpass-api-client

## ライセンス

MIT
