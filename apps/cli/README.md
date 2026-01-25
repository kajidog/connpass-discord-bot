# Connpass Discord Bot CLI

Connpass Discord Botの設定を管理するためのCLIアプリケーションです。

## 機能

- **メインメニュー** - 3つの機能を選択可能
  - 🎮 Discordの設定 - サーバー/チャンネル選択とFeed設定管理
  - ⚙️ 現在の設定 - 環境変数から読み込んだ設定を一覧表示
  - 📋 ログの表示 - システムログをリアルタイム表示（フィルタリング機能付き）
- Discord サーバー/チャンネルの選択
- Feed設定の表示・変更・削除
- Feed実行ログの表示
- コマンド補完機能（サジェスト + 履歴）

## 必要環境

- Node.js 18+
- pnpm
- Discord Bot Token（Discordの設定機能を使う場合）

## セットアップ

```bash
# プロジェクトルートで依存関係をインストール
pnpm install

# CLIをビルド
pnpm --filter @connpass-discord-bot/cli build
```

## 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `DISCORD_BOT_TOKEN` | Discord Bot Token | Discordの設定に必須 |
| `STORAGE_TYPE` | ストレージ種別（`file` or `sqlite`） | `file` |
| `JOB_STORE_DIR` | Feed設定の保存先ディレクトリ | `./data` |
| `DATABASE_URL` | SQLiteデータベースのパス | `${JOB_STORE_DIR}/app.db` |
| `DB_PATH` | SQLiteデータベースのパス（互換用/非推奨） | `./data/connpass.db` |
| `LOG_LEVEL` | ログレベル（`DEBUG`, `INFO`, `WARN`, `ERROR`） | `INFO` |

## 使用方法

```bash
# 開発モードで起動
pnpm --filter @connpass-discord-bot/cli dev

# または直接実行
cd apps/cli
DISCORD_BOT_TOKEN=your_token pnpm dev
```

## 操作方法

### メインメニュー

起動すると以下のメニューが表示されます：

```
┌─────────────────────────────────────────┐
│  Connpass Discord Bot CLI              │
└─────────────────────────────────────────┘

メニューを選択してください:

❯ 🎮 Discordの設定
  ⚙️  現在の設定
  📋 ログの表示

↑↓: 選択  Enter: 決定  Ctrl+C: 終了
```

### 🎮 Discordの設定

1. **サーバー選択** - ↑↓キーで選択、Enterで決定
2. **チャンネル選択** - ↑↓キーで選択、Enterで決定、Escで戻る
3. **コマンド入力** - コマンドを入力してEnterで実行

### ⚙️ 現在の設定

環境変数から読み込んだ設定を確認できます：

- **Discord** - Bot Token、Application ID
- **AI** - OpenAI、Google AI、Anthropic のAPIキー（マスク表示）
- **データ保存** - DB_PATH、REDIS_URL、FEEDS_PATH
- **ログ** - LOG_LEVEL、LOG_DESTINATION
- その他のスケジューラー設定

### 📋 ログの表示

システムログをリアルタイムで確認できます：

| キー | 動作 |
|------|------|
| `Tab` | ログレベル切替（DEBUG → INFO → WARN → ERROR） |
| `/` | キーワード検索モード開始 |
| `Backspace` | フィルタークリア |
| `Shift+↑` / `Shift+↓` | ログのスクロール |
| `Esc` | メニューに戻る |

### グローバルキーバインド

| キー | 動作 |
|------|------|
| `Tab` | サジェスト選択を適用 / ログレベル切替 |
| `↑` / `↓` | 選択 / コマンド履歴ナビゲーション |
| `Shift+↑` / `Shift+↓` | ログのスクロール |
| `Enter` | 決定 / コマンド実行 |
| `Esc` | 前の画面 / メニューに戻る |
| `Ctrl+C` | アプリ終了 |

## コマンド一覧

### Feed設定

```bash
# 現在の設定を表示
/connpass feed status

# 設定を変更
/connpass feed set schedule:0 9 * * *
/connpass feed set keywords_and:TypeScript,React
/connpass feed set keywords_or:勉強会,もくもく
/connpass feed set range_days:14
/connpass feed set location:東京都
/connpass feed set use_ai:true

# 複数設定を同時に変更
/connpass feed set schedule:0 9 * * * keywords_and:TypeScript range_days:7

# 設定を削除
/connpass feed remove

# Feed実行ログを表示
/connpass feed logs
```

### 設定オプション詳細

| オプション | 説明 | 例 |
|-----------|------|-----|
| `schedule` | cron形式のスケジュール | `0 9 * * *` (毎日9時) |
| `keywords_and` | AND検索キーワード（カンマ区切り） | `TypeScript,React` |
| `keywords_or` | OR検索キーワード（カンマ区切り） | `勉強会,もくもく` |
| `range_days` | 検索範囲日数 | `14` |
| `location` | 開催場所フィルタ | `東京都`, `オンライン` |
| `use_ai` | AI要約の有効/無効 | `true` / `false` |

## サジェスト機能

コマンド入力中に自動でサジェストが表示されます。

- **コマンドサジェスト**: 入力に応じたコマンド候補を表示
- **都道府県サジェスト**: `location:` 入力後に都道府県一覧を表示
- **Tab補完**: 選択中のサジェストを適用

## コマンド履歴

- `↑` / `↓` キーで過去に実行したコマンドを呼び出せます
- サジェストが表示されている場合はサジェストナビゲーションが優先されます

## UI構成

### メインメニュー

```
┌─────────────────────────────────────────┐
│  Connpass Discord Bot CLI              │
└─────────────────────────────────────────┘

メニューを選択してください:

❯ 🎮 Discordの設定
  ⚙️  現在の設定
  📋 ログの表示
```

### Discordの設定画面

```
┌─────────────────────────────────────────┐
│ Connpass CLI / ServerName / #channel    │  ← ヘッダー
├─────────────────────────────────────────┤
│ ログ (Shift+↑↓: スクロール)             │
│ [10:30] > /connpass feed status         │
│ [10:30] 現在の設定:                     │  ← ログエリア
│         スケジュール: 0 9 * * *         │
├─────────────────────────────────────────┤
│ > /connpass feed _                      │  ← 入力エリア
├─────────────────────────────────────────┤
│ サジェスト (Tab: 選択, ↑↓: 移動)        │
│  > /connpass feed status - 現在の設定   │  ← サジェスト
│    /connpass feed set schedule:         │
├─────────────────────────────────────────┤
│ Tab: 補完 | ↑↓: 履歴 | Enter: 実行 ...  │  ← ステータスバー
└─────────────────────────────────────────┘
```

### 設定表示画面

```
⚙️  現在の設定

▸ Discord
  Discord Bot Token:     Bot1****5678    (DISCORD_BOT_TOKEN)
  Discord Application ID: 123456789       (DISCORD_APPLICATION_ID)

▸ AI
  OpenAI API Key:        sk-1****abcd    (OPENAI_API_KEY)

▸ データ保存
  データベースパス:       ./data/app.db   (DB_PATH)

▸ ログ
  ログレベル:            INFO            (LOG_LEVEL)

Esc: メニューに戻る  Ctrl+C: 終了
```

### ログ表示画面

```
📋 システムログ (25/100件)

レベル: INFO (Tab: 切替)  検索: (なし) (/: 編集)

┌─────────────────────────────────────────┐
│ [10:30:15] [INFO]  [Discord] Connected  │
│ [10:30:16] [DEBUG] [Feed] Loading...    │
│ [10:30:17] [WARN]  [API] Rate limited   │
└─────────────────────────────────────────┘

Tab: レベル切替  /: 検索  Shift+↑↓: スクロール  Esc: 戻る
```

## トラブルシューティング

### メニューで「Discordの設定」が選べない

`DISCORD_BOT_TOKEN` 環境変数が設定されていない場合、Discordの設定機能は使用できません。
設定表示やログ表示機能は Token なしでも使用可能です。

### DBに接続できない

`DATABASE_URL`（または互換用の `DB_PATH`）で正しいデータベースパスを指定してください。
ログ表示機能には feed-worker が使用するSQLiteデータベースが必要です。

### Discord Botと同じFeedを使いたい

- **SQLiteを使っている場合**: `STORAGE_TYPE=sqlite` と `DATABASE_URL` をBotと同じ値にしてください。
- **Fileストレージの場合**: `JOB_STORE_DIR` をBotと同じディレクトリに合わせてください（相対パスの場合、起動ディレクトリが違うと別扱いになります）。

### Botがサーバーに接続できない

- `DISCORD_BOT_TOKEN` が正しいか確認してください
- Botが対象サーバーに招待されているか確認してください
- Botに必要な権限が付与されているか確認してください

## ライセンス

MIT
