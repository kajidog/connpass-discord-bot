# Connpass Discord Bot

ConnpassイベントをDiscordに通知するBot。AIアシスタント機能付き。

## 機能

- **定期通知**: cron式で指定したスケジュールでイベントを自動通知
- **イベント検索**: キーワード、日付、場所で絞り込み
- **AIアシスタント**: Botにメンションして会話形式でイベント検索
- **詳細表示**: ボタンクリックでイベント詳細とAI要約を表示
- **イベント通知**: 参加予定イベント開始前にDMでリマインド通知

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

# ストレージ設定
STORAGE_TYPE=sqlite          # sqlite（推奨）または file
DATABASE_URL=./data/app.db   # SQLite DBファイルパス
JOB_STORE_DIR=./data         # Fileストレージ使用時のディレクトリ

# オプション
ENABLE_AI_AGENT=true
LOG_LEVEL=info               # debug, info, warn, error
LOG_DESTINATION=both         # console, database, both
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

## CLI/TUIモード

Discordと同じスラッシュコマンドをターミナルから実行できます。

```bash
# ビルド
pnpm --filter @connpass-discord-bot/cli build

# 起動
pnpm --filter @connpass-discord-bot/cli start
```

### 操作フロー

1. サーバー選択（矢印キー + Enter）
2. チャンネル選択
3. コマンド入力: `/connpass feed status`
4. Escで戻る / Ctrl+Cで終了

### 対応コマンド

- `/connpass feed status` - 設定確認
- `/connpass feed set schedule:「cron式」` - 設定追加/更新
- `/connpass feed remove` - 設定削除
- `/connpass feed share` - 設定をCLIコマンド形式で出力
- `/connpass feed apply channels:ID1,ID2 ...` - 複数チャンネルに一括適用（CLIのみ）

### Dockerでの使用

```bash
docker compose run --rm -it bot pnpm --filter @connpass-discord-bot/cli start
```

> ⚠️ CLIはインタラクティブなTUIなので `-it` オプションが必要です

## 使い方

### スラッシュコマンド

| コマンド | 説明 |
|---------|------|
| `/connpass feed set` | フィード設定 |
| `/connpass feed status` | 設定確認 |
| `/connpass feed remove` | フィード削除 |
| `/connpass feed run` | 手動実行 |
| `/connpass feed share` | 設定をCLIコマンド形式で出力 |
| `/connpass user register` | ニックネーム登録 |
| `/connpass model set` | チャンネルのAIモデル設定 |
| `/connpass model status` | モデル設定確認 |
| `/connpass model reset` | モデル設定リセット |
| `/connpass admin add` | 管理者追加 |
| `/connpass admin remove` | 管理者削除 |
| `/connpass admin ban` | ユーザーをBAN |
| `/connpass admin unban` | BAN解除 |
| `/connpass admin list` | 管理者/BAN一覧 |
| `/connpass notify on` | イベント通知ON |
| `/connpass notify off` | イベント通知OFF |
| `/connpass notify status` | 通知設定確認 |
| `/connpass today` | 今日のイベント |

**権限メモ**

- 管理者未登録のときだけ `/connpass admin add` は誰でも実行可能
- BANされたユーザーはAI機能、モデル変更、Feed変更ができません

### フィードの規模フィルタ

`/connpass feed set` で以下の条件を指定すると、参加人数または募集人数が条件を満たすイベントのみ通知します。

- `min_participants`: 参加人数が指定人数以上
- `min_limit`: 募集人数が指定人数以上

### フィード設定の一括適用（CLI）

`/connpass feed share` で現在の設定をCLIコマンド形式で出力し、`/connpass feed apply` で複数チャンネルに一括適用できます。

```bash
# 1. Discordまたは CLIで設定をエクスポート
/connpass feed share
# 出力例: /connpass feed apply channels:123456 schedule:0\ 9\ *\ *\ 1 keywords_and:TypeScript,React

# 2. CLIで複数チャンネルに適用
/connpass feed apply channels:123456,789012,345678 schedule:0\ 9\ *\ *\ 1 keywords_and:TypeScript,React
```

**applyコマンドのオプション**:
- `channels:` - 適用先チャンネルID（カンマ区切りで複数指定）
- `schedule:` - cron式（スペースは `\ ` でエスケープ）
- `keywords_and:` / `keywords_or:` - 検索キーワード
- `range_days:` / `location:` / `use_ai:` など、`feed set` と同じオプション

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

## データベースクリーンアップ

SQLiteストレージ使用時、古いデータは自動的にクリーンアップされます。

### デフォルト保持期間

| データ | 保持期間 | 説明 |
|-------|---------|------|
| アプリログ (`app_logs`) | 7日 | デバッグ・トラブルシューティング用 |
| アクションログ (`action_logs`) | 30日 | ユーザー操作の監査ログ |
| 送信済みイベント (`feed_sent_events`) | 90日 | 重複送信防止用 |
| イベント要約キャッシュ (`event_summary_cache`) | 30日 | AI要約のキャッシュ |
| 通知送信済み (`user_notify_sent_events`) | 30日 | DM通知の重複防止用 |

クリーンアップは起動時と24時間ごとに自動実行されます。

## 構成

```
apps/
├── discord-bot/    # Discord Bot本体
├── cli/            # CLI/TUIアプリケーション
└── ai-agent/       # Mastra AIエージェント（参考実装）

packages/
├── core/           # 共通型・インターフェース・コマンドハンドラー
└── feed-worker/    # フィード実行・スケジューラー
```

## 技術スタック

- **Runtime**: Node.js 22+
- **Discord**: discord.js
- **AI**: Mastra + Vercel AI SDK (OpenAI / Claude / Gemini)
- **CLI/TUI**: Ink (React for CLI)
- **API**: @kajidog/connpass-api-client

## ライセンス

MIT
