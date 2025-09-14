# Connpass Discord Bot

Connpass のイベント情報を定期取得し、Discord チャンネルへ新着のみを通知するボット（Monorepo）。

**パッケージ**

- `packages/api-client`: Connpass API v2 の TypeScript クライアント
- `packages/job`: 取得ジョブの管理・スケジュール・簡易REST API（ライブラリ/組込サーバ）
- `packages/discord-bot`: Discord ボット本体（スラッシュコマンドでジョブを操作）

---

## 特長

- **定期取得**: Connpass API からイベントをポーリング
- **新着のみ通知**: `updatedAt` と `id` を用いた重複抑止
- **柔軟な検索**: AND/OR キーワード、日付範囲、開催地フィルタ
- **Discord 操作**: `/connpass` コマンドでチャンネル単位に設定（ソート順の変更対応）
- **永続化**: ファイルストア（任意）で再起動後も状態維持

---

## 必要環境

- **Node**: `>= 18`
- **pnpm**: `>= 8`

---

## セットアップ

- **依存導入**: `pnpm install`
- **ビルド**: `pnpm -r build`
- **環境変数**: `.env.example` をコピーして `.env` を用意

`.env.example` には以下が含まれます:

- `DISCORD_BOT_TOKEN`: Discord Bot Token
- `DISCORD_APPLICATION_ID`: Discord アプリケーションID
- `DISCORD_GUILD_ID`: 任意。指定時はギルドスコープでコマンド登録
- `CONNPASS_API_KEY`: Connpass API キー
- `JOB_STORE_DIR`: 任意。ファイル永続化ディレクトリ（例: `./data/jobs`）

---

## 実行（ローカル）

- **コマンド登録**（初回/更新時）:
  - `pnpm -r build`
  - `pnpm --filter @connpass-discord-bot/discord-bot run register`
- **起動**:
  - `pnpm --filter @connpass-discord-bot/discord-bot start`

起動時に `JOB_STORE_DIR` を設定すると、ジョブと状態がファイル永続化されます。

---

## スラッシュコマンド

- `/connpass set`
  - **interval_sec**: 実行間隔秒（既定 1800）
  - **keywords_and**: AND 検索キーワード（カンマ/スペース区切り、複数可）
  - **keywords_or**: OR 検索キーワード（カンマ/スペース区切り、複数可）
  - 両方を同時に指定可能（AND と OR を併用）
  - **range_days**: 検索範囲日数（既定 14）
  - **location**: 開催地の都道府県（オートコンプリート対応、カンマ区切りで複数指定可）
  - **hashtag**: ハッシュタグ（先頭の `#` は不要、完全一致）
  - **owner_nickname**: 主催者ニックネーム
- `/connpass user register`
  - **nickname**: あなたの Connpass ニックネーム
- `/connpass user show`: 登録済みのニックネームを表示（未登録なら案内）
- `/connpass user unregister`: ニックネームの登録解除
- `/connpass today`: あなたが参加登録している今日のイベントを表示
- `/connpass sort`
  - **order**: 並び順の種類
    - `更新日時の降順 (updated_desc)` → API `order=1`
    - `開催日時の昇順 (started_asc)` → API `order=2`（既定）
    - `開催日時の降順 (started_desc)` → API `order=3`
- `/connpass status`: 現在の設定表示
- `/connpass remove`: 監視の削除
- `/connpass run`: 手動実行

ジョブIDはチャンネルIDと同一で、通知先はそのチャンネルになります。

メモ: ユーザーのニックネーム登録は `JOB_STORE_DIR` を設定した場合にファイルへ永続化されます。未設定時はプロセスのメモリ上に保持され、再起動で消えます。

---

## Docker / Compose

- **Dockerfile**: `packages/discord-bot/Dockerfile`
- **Compose**: `deploy/docker-compose.yml`

手順:

- **.env 作成**: `.env.example` を `.env` にコピー・編集
- **ビルド**: `docker compose -f deploy/docker-compose.yml build`
- **起動**: `docker compose -f deploy/docker-compose.yml up -d`
- **コマンド登録**:
  - `docker compose -f deploy/docker-compose.yml run --rm discord-bot node packages/discord-bot/dist/registerCommands.js`

`JOB_STORE_DIR` はコンテナでは `/data/jobs` に設定し、ホストの `./data/jobs` をマウントしています。

---

## テスト

- **全体実行**: `pnpm test`
- **対象限定**: `pnpm --filter @connpass-discord-bot/job test`

含まれるテスト:

- `JobManager`: 新着判定、場所フィルタ、updatedAt 再通知
- `JobScheduler`: 即時実行とインターバル実行（フェイクタイマー）
- `FileJobStore`: CRUD と Set 復元、壊れたJSONの無視

---

## 設計（概要）

- **job ライブラリ**
  - `JobManager`: ジョブ登録/更新/削除/単発実行
  - `JobScheduler`: `setInterval` による定期実行（即時実行あり）
  - `JobSink`: 通知先の抽象（Discord など）。デフォルト `ConsoleSink`
  - `JobStore`: ストアの抽象。`InMemoryJobStore` / `FileJobStore` 実装
  - `startHttpApi`: 軽量REST（任意機能）
- **discord-bot**
  - `DiscordSink`: 新着イベントをチャンネルへ投稿
  - スラッシュコマンドでチャンネル単位の設定を反映

将来的にボットとジョブを分離運用する場合、job の HTTP API を別プロセスで起動し、ボットから REST で操作することも可能です。

---

## 開発メモ

- **ビルド**: `pnpm -r build`
- **型チェック**: `pnpm -r typecheck`
- **テスト**: `pnpm test`

詳細は `MEMO.md` を参照してください。
