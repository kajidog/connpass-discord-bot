# Connpass Discord Bot CLI

Connpass Discord Botの設定を管理するためのCLIアプリケーションです。

## 機能

- Discord サーバー/チャンネルの選択
- Feed設定の表示・変更・削除
- Feed実行ログの表示
- コマンド補完機能（サジェスト + 履歴）

## 必要環境

- Node.js 18+
- pnpm
- Discord Bot Token

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
| `DISCORD_BOT_TOKEN` | Discord Bot Token | 必須 |
| `STORAGE_TYPE` | ストレージ種別（`file` or `sqlite`） | `file` |
| `JOB_STORE_DIR` | Feed設定の保存先ディレクトリ | `./data` |
| `DATABASE_URL` | SQLiteデータベースのパス | `${JOB_STORE_DIR}/app.db` |
| `DB_PATH` | SQLiteデータベースのパス（互換用/非推奨） | `./data/connpass.db` |

## 使用方法

```bash
# 開発モードで起動
pnpm --filter @connpass-discord-bot/cli dev

# または直接実行
cd apps/cli
DISCORD_BOT_TOKEN=your_token pnpm dev
```

## 操作方法

### 画面遷移

1. **サーバー選択** - ↑↓キーで選択、Enterで決定
2. **チャンネル選択** - ↑↓キーで選択、Enterで決定、Escで戻る
3. **コマンド入力** - コマンドを入力してEnterで実行

### キーバインド

| キー | 動作 |
|------|------|
| `Tab` | サジェスト選択を適用 |
| `↑` / `↓` | コマンド履歴のナビゲーション |
| `Shift+↑` / `Shift+↓` | ログのスクロール |
| `Enter` | コマンド実行 |
| `Esc` | 前の画面に戻る |
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

## トラブルシューティング

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
