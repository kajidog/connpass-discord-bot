# Connpass Discord Bot

Connpass のイベント情報を定期取得し、Discord チャンネルへ新着のみを通知するボット（Monorepo）。

**パッケージ**

- `packages/api-client`: Connpass API v2 の TypeScript クライアント
- `packages/job`: 取得ジョブの管理・スケジュール・簡易REST API（ライブラリ/組込サーバ）
- `packages/discord-bot`: Discord ボット本体（スラッシュコマンドでジョブを操作）
- `packages/mastra`（任意）: Mastra Agent サーバ（AI要約に使用、OpenAI などの LLM キーが必要）
- `packages/mcp-server`（任意）: MCP（Model Context Protocol）サーバ。Connpass API を MCP 経由で利用するためのツール群

---

## 特長

- **定期取得**: Connpass API からイベントをポーリング
- **新着のみ通知**: `updatedAt` と `id` を用いた重複抑止
- **柔軟な検索**: AND/OR キーワード、日付範囲、開催地フィルタ
- **Discord 操作**: `/connpass` コマンドでチャンネル単位に設定（ソート順の変更対応）
- **永続化**: ファイルストア（任意）で再起動後も状態維持
- **リッチ投稿**: イベントは埋め込みで投稿、OG画像を可能な範囲で添付（最大5MB）
- **メッセージ操作**: 各イベント投稿に「詳細」「登壇」「重複チェック」「Web」「地図」ボタン
  - 詳細/登壇は専用スレッド（例: `イベント詳細-<ID>`）に返信
  - 重複チェックは、自分の参加予定（要ニックネーム登録）と時間帯が重なるイベントを照会
- **レポート生成**: 条件に合うイベントを集計して投稿。Discord の 2000 文字制限に合わせて自動分割
- **AI要約（任意）**: Mastra Agent API を使って要約文を生成（`MASTRA_BASE_URL` を設定した場合）

---

## できること（概要）

以下は主な機能ごとの「できること」要約と、詳細なコマンドの使い方です。まずは要約を確認し、必要に応じて展開してください。

<details>
<summary>/connpass feed: チャンネル監視（新着のみ通知）</summary>

できること

- キーワードや場所、期間でフィード（監視）を設定
- 並び順（updated/started asc/desc）を変更
- 現在の設定を確認・削除、手動実行

コマンド

- ` /connpass feed set `
  - 概要: このチャンネルの監視条件を追加/更新
  - 主なオプション:
    - `interval_sec` 実行間隔秒（既定 1800）
    - `keywords_and` AND 検索（カンマ/スペース区切り）
    - `keywords_or` OR 検索（カンマ/スペース区切り）
    - `range_days` 検索範囲日数（既定 14）
    - `location` 都道府県（オートコンプリート、カンマ/スペース区切り可）
    - `hashtag` ハッシュタグ（先頭 `#` 不要・完全一致）
    - `owner_nickname` 主催者ニックネーム
    - `order` `updated_desc | started_asc | started_desc`

- ` /connpass feed sort `
  - 概要: 並び順のみ更新
  - `order`: `updated_desc | started_asc | started_desc`

- ` /connpass feed status `: 現在の監視設定を表示

- ` /connpass feed run `: 監視の手動実行（設定直後は自動実行しません）

- ` /connpass feed remove `: 監視の削除

補足

- ジョブID＝チャンネルID。通知先はそのチャンネル。
- `JOB_STORE_DIR` 設定時はファイル永続化、未設定時はメモリ保持。

</details>

<details>
<summary>/connpass report: レポート生成（AI要約対応・スケジュール運用）</summary>

できること

- 条件に合うイベントを集約して投稿（オンデマンド）
- AI要約のON/OFFや要約テンプレートの指定
- チャンネル既定（AI要約・スケジュール・レポート用フィルタ）を設定/確認
- 2000文字制限に合わせて自動分割投稿

コマンド

- ` /connpass report run `
  - 概要: その場でレポートを生成して投稿
  - 既定: `range_days=7`, `order=started_asc`
  - 主なオプション:
    - `ai` この実行のみAI要約をON/OFF（既定はチャンネル設定）
    - `summary_template` この実行のみの要約指示
    - `keywords_and`, `keywords_or`, `location`, `hashtag`, `owner_nickname`, `order`

- ` /connpass report set `
  - 概要: チャンネルの既定（AI要約・スケジュール・レポート用フィルタ）を設定
  - 主なオプション:
    - スケジュール: `enabled`, `interval_sec`, `range_days`
    - レポート用フィルタ: `keywords_and`, `keywords_or`, `location`, `hashtag`, `owner_nickname`, `order`
    - AI要約: `ai_enabled`, `summary_template`
  - 備考: レポート用フィルタ未指定時は feed 設定を継承

- ` /connpass report status `: 現在のチャンネル既定を表示

補足

- `MASTRA_BASE_URL` 未設定時は非AIの通常レポートに自動フォールバックします。
- スケジュール投稿は「初回即時実行なし」。指定間隔ごとに投稿します。

</details>

<details>
<summary>/connpass user: ユーザー設定（ニックネーム）</summary>

できること

- 自分の connpass ニックネームの登録/表示/解除
- 登録済みニックネームは重複チェックや「今日の予定」で使用

コマンド

- ` /connpass user register nickname:<your_nickname> `
- ` /connpass user show `（取得できればID/プロフィールURLも表示）
- ` /connpass user unregister `

補足

- `JOB_STORE_DIR` 設定時はファイル永続化、未設定時はメモリ保持（再起動で消去）。

</details>

<details>
<summary>/connpass today: 本日の参加予定を表示</summary>

できること

- 登録済みニックネームのユーザーについて、JST基準で「今日」のイベントを一覧表示

コマンド

- ` /connpass today `

補足

- 並び順は開始日時昇順。時刻はJST表示。

</details>

<details>
<summary>メッセージボタン（イベント投稿）</summary>

できること

- 各イベント投稿に付くボタンで、追加情報の取得や導線を提供

ボタンの動作

- `詳細`: イベント詳細を専用スレッドに埋め込み投稿
- `登壇`: 登壇情報（タイトル/登壇者/リンク）をスレッドに投稿
- `重複チェック`: 自分の参加予定と時間帯が重なるイベントを照会（ニックネーム登録が必要）
- `Web`: Connpass イベントページを開く
- `地図`: 緯度経度または住所から Google マップを開く

補足

- スレッド名は `イベント詳細-<ID>`。OG画像を可能な範囲で添付（最大5MB）。

</details>

---

## 必要環境

- **Node**: `>= 18`（Discord ボット/ジョブ）
  - Mastra サービス（AI要約）を使う場合は `>= 20.9.0` 推奨
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
- `CONNPASS_API_KEY`: Connpass API キー（必須）
- `JOB_STORE_DIR`: 任意。ファイル永続化ディレクトリ（例: `./data/jobs`）
- `MASTRA_BASE_URL`: 任意。Mastra Agent API のベースURL（例: `http://localhost:4111`）
  - 未設定の場合、AI要約機能は無効（通常の非AIレポート出力）
- `OPENAI_API_KEY`: Mastra サービスを使う場合に必要（Mastra コンテナ/プロセス側で参照）

---

## 実行（ローカル）

- **コマンド登録**（初回/更新時）:
  - `pnpm -r build`
  - `pnpm --filter @connpass-discord-bot/discord-bot run register`
- **起動**:
  - `pnpm --filter @connpass-discord-bot/discord-bot start`

起動時に `JOB_STORE_DIR` を設定すると、ジョブと状態がファイル永続化されます。

AI要約を使う場合は、別途 Mastra サーバを起動し `MASTRA_BASE_URL` を設定してください。

---

## スラッシュコマンド

- `/connpass feed set`
  - **interval_sec**: 実行間隔秒（既定 1800）
  - **keywords_and**: AND 検索キーワード（カンマ/スペース区切り、複数可）
  - **keywords_or**: OR 検索キーワード（カンマ/スペース区切り、複数可）
  - 両方を同時に指定可能（AND と OR を併用）
  - **range_days**: 検索範囲日数（既定 14）
  - **location**: 開催地の都道府県（オートコンプリート対応、カンマ区切りで複数指定可）
  - **hashtag**: ハッシュタグ（先頭の `#` は不要、完全一致）
  - **order**: 並び順（任意）— `updated_desc` | `started_asc` | `started_desc`
  - **owner_nickname**: 主催者ニックネーム
- `/connpass feed sort`
  - **order**: 並び順の種類
    - `更新日時の降順 (updated_desc)` → API `order=1`
    - `開催日時の昇順 (started_asc)` → API `order=2`（既定）
    - `開催日時の降順 (started_desc)` → API `order=3`
- `/connpass feed status`: 現在の監視設定表示
- `/connpass feed remove`: 監視の削除
- `/connpass feed run`: 手動実行（設定直後は自動実行しません）
- `/connpass user register`
  - **nickname**: あなたの Connpass ニックネーム
- `/connpass user show`: 登録済みのニックネームを表示（未登録なら案内）
- `/connpass user unregister`: ニックネームの登録解除
- `/connpass today`: あなたが参加登録している今日のイベントを表示
- `/connpass report run`: 条件に合うイベントを集約して投稿（オンデマンド）。AI要約対応。
  - 既定: `range_days=7`, `order=started_asc`
  - オプション: `ai`（この実行のみON/OFF）, `summary_template`（この実行のみの要約方針）, `keywords_and`, `keywords_or`, `range_days`, `location`, `hashtag`, `owner_nickname`, `order`
  - 出力は2000文字制限に合わせて自然な位置で自動分割
- `/connpass report set`: このチャンネルの要約/スケジュール/レポート用フィルタ既定を設定
  - オプション: 
    - スケジュール: `enabled`, `interval_sec`, `range_days`
    - レポート用フィルタ（feedと同等）: `keywords_and`, `keywords_or`, `location`, `hashtag`, `owner_nickname`, `order`
    - AI要約: `ai_enabled`, `summary_template`
  - 備考: レポート用フィルタを未指定のままにすると、feedの設定を継承して使用します。
- `/connpass report status`: このチャンネルの要約/スケジュール既定を表示

ジョブIDはチャンネルIDと同一で、通知先はそのチャンネルになります。

メモ:
- ユーザーのニックネーム登録は `JOB_STORE_DIR` 設定時にファイルへ永続化。未設定時はメモリ保持（再起動で消去）。
- `/connpass user show` は API からユーザーID/プロフィールURLを引けた場合、あわせて表示します。

### メッセージボタン（イベント投稿）

各イベントの埋め込み投稿には次のボタンが付きます:

- `詳細`: イベントの詳細埋め込みをスレッドに投稿
- `登壇`: 登壇情報（タイトル/登壇者/リンク）をスレッドに投稿
- `重複チェック`: 自分の参加予定（登録済みニックネーム）と時間帯が重なるイベントを照会
- `Web`: イベントページへのリンク
- `地図`: 位置情報がある場合に Google マップを開くリンク


---

## Docker

- **Dockerfile**: `packages/discord-bot/Dockerfile`
- **Compose**: `deploy/docker-compose.yml`

構成:

- `mastra` サービス（ポート `4111`）: Mastra Agent API。AI要約に使用。`OPENAI_API_KEY` が必要。
- `discord-bot` サービス: 本ボット。`MASTRA_BASE_URL=http://mastra:4111` が自動で設定されます。

手順:

- **.env 作成**: `.env.example` を `.env` にコピー・編集（少なくとも `DISCORD_*`, `CONNPASS_API_KEY`。AI要約を使うなら `OPENAI_API_KEY` も）
- **ビルド**: `docker compose -f deploy/docker-compose.yml build`
- **起動**: `docker compose -f deploy/docker-compose.yml up -d`
- **コマンド登録**（一度だけ、またはコマンド構成を変更したとき）:
  - `docker compose -f deploy/docker-compose.yml run --rm discord-bot node packages/discord-bot/dist/registerCommands.js`

`JOB_STORE_DIR` はコンテナでは `/data/jobs` に設定し、ホストの `./data/jobs` をマウントしています。

---

## テスト

- **全体実行**: `pnpm test`
- **対象限定**: `pnpm --filter @connpass-discord-bot/job test`

含まれるテスト:

- `JobManager`: 新着判定、場所フィルタ、updatedAt 再通知
- `JobScheduler`: 初回は実行せず、インターバルで実行（フェイクタイマー）
- `FileJobStore`: CRUD と Set 復元、壊れたJSONの無視

---

## 設計（概要）

- **job ライブラリ**
  - `JobManager`: ジョブ登録/更新/削除/単発実行
- `JobScheduler`: `setInterval` による定期実行（初回は即時実行しない）
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
- HTML → Discord テキスト変換の簡易プレビュー: `node scripts/preview-html.js <htmlを含むテキストファイル>`

注: Mastra サービスのローカル起動は `pnpm --filter mastra dev`（OpenAI キーが必要）で可能です。
