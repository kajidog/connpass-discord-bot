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

# AI Provider API Keys（使用するプロバイダーのみ設定）
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...

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
| `/connpass model set` | チャンネルのAIモデル設定 |
| `/connpass model status` | モデル設定確認 |
| `/connpass model reset` | モデル設定リセット |
| `/connpass admin add` | 管理者追加 |
| `/connpass admin remove` | 管理者削除 |
| `/connpass admin ban` | ユーザーをBAN |
| `/connpass admin unban` | BAN解除 |
| `/connpass admin list` | 管理者/BAN一覧 |
| `/connpass today` | 今日のイベント |

**権限メモ**

- 管理者未登録のときだけ `/connpass admin add` は誰でも実行可能
- BANされたユーザーはAI機能、モデル変更、Feed変更ができません

### フィードの規模フィルタ

`/connpass feed set` で以下の条件を指定すると、参加人数または募集人数が条件を満たすイベントのみ通知します。

- `min_participants`: 参加人数が指定人数以上
- `min_limit`: 募集人数が指定人数以上

### AIアシスタント

Botにメンションして質問：

```
@Bot 来週の東京でのTypeScriptイベントを探して
@Bot 私の今週の予定を教えて
@Bot Feedの設定して
```

**💡 会話のコンテキストについて**

- **イベント情報の保持**: スレッドの元となったイベント詳細を常に把握しています。
- **直近の会話履歴**: 直近のメッセージを認識して回答します。
- **履歴の自動取得**: 文脈が不足している場合、AIが必要に応じて過去の会話ログを自動的に参照します。

## AIモデル設定

AIモデルはチャンネルごとに設定可能です。OpenAI、Claude、Geminiに対応しています。

### グローバル設定（デフォルト）

`apps/discord-bot/config/ai-models.json` でデフォルトモデルを設定：

```json
{
  "agent": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  },
  "summarizer": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  },
  "allowedModels": {
    "openai": ["gpt-4o-mini"],
    "anthropic": ["claude-4-5-haiku"],
    "google": ["gemini-2.5-flash"]
  }
}
```

- `agent`: AIアシスタント（会話）で使用するモデル
- `summarizer`: イベント要約で使用するモデル
- `allowedModels`: 使用可能なモデルのホワイトリスト

### チャンネルごとの設定

`/connpass model set` コマンドでチャンネルごとにモデルを設定できます：

```
/connpass model set type:エージェント（会話） provider:anthropic model:claude-4-5-haiku
/connpass model set type:要約 provider:openai model:gpt-4o-mini
```

チャンネル設定がない場合は、グローバル設定が使用されます。
`/connpass model status` で現在の設定を確認できます。

### 対応プロバイダー

| プロバイダー | 環境変数 | 推奨モデル |
|-------------|---------|-----------|
| OpenAI | `OPENAI_API_KEY` | gpt-4o-mini |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | claude-3-5-haiku-20241022 |
| Google (Gemini) | `GOOGLE_GENERATIVE_AI_API_KEY` | gemini-1.5-flash |

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
- **AI**: Mastra + Vercel AI SDK (OpenAI / Claude / Gemini)
- **API**: @kajidog/connpass-api-client

## ライセンス

MIT
