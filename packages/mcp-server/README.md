# Connpass MCP Server

Connpass MCP Server は、MCP (Model Context Protocol) 経由で Connpass API を扱うためのツール群です。AI やエージェントが理解しやすいパラメータ設計になっており、自然言語に近い入力でイベント・グループ・ユーザー情報を取得できます。

## セットアップ

1. 依存関係をインストールします。

   ```bash
   pnpm install
   ```

2. ビルドして利用可能な状態にします。

   ```bash
   pnpm --filter @kajidog/connpass-mcp-server build
   ```

3. Connpass API キーを環境変数で指定してサーバーを起動します。

   ```bash
   CONNPASS_API_KEY=あなたのAPIキー pnpm --filter @kajidog/connpass-mcp-server start
   ```

   > ローカル開発時などで API キーが未設定の場合、`dummy-key` が自動で使用されます。

必要に応じて、デフォルトで参照するユーザー ID を `CONNPASS_DEFAULT_USER_ID` に設定できます。`get_my_upcoming_events` ツールで `userId` を省略した場合に利用されます。

### 環境変数一覧

| 変数名 | 説明 | 既定値 |
| --- | --- | --- |
| `CONNPASS_API_KEY` | Connpass API Key。未設定の場合は `dummy-key` が使われます（本番利用不可）。 | `dummy-key` |
| `CONNPASS_DEFAULT_USER_ID` | `get_my_upcoming_events` で `userId` を省略したときに使うユーザー ID。 | 未設定 |
| `CONNPASS_INCLUDE_PRESENTATIONS_DEFAULT` | `get_my_upcoming_events` の `includePresentations` の既定値。`true/false` や `1/0` などで指定。 | 未設定（false と同等） |
| `CONNPASS_PRESENTATION_CACHE_ENABLED` | プレゼンテーション取得結果をディスクキャッシュするかどうか。 | `true` |
| `CONNPASS_PRESENTATION_CACHE_TTL_MS` | キャッシュ保持期間（ミリ秒）。 | `3600000` |
| `CONNPASS_PRESENTATION_CACHE_PATH` | キャッシュファイルの保存先パス。 | `./data/presentation-cache.json` |

## npm パッケージ公開フロー

`@kajidog/connpass-mcp-server` は npm で公開できるよう設定されています（内部で `@kajidog/connpass-api-client` を利用するため、MCP サーバーを公開する場合は API クライアントも同じバージョンで公開する必要があります）。ワークスペース内だけで使う場合は API クライアントを公開する必要はありません。

1. `.npmrc` などで npm token を設定します（`//registry.npmjs.org/:_authToken=<TOKEN>`）。
2. 変更を反映する Changeset を作成します。
   ```bash
   pnpm changeset
   ```
3. バージョンと changelog を反映します。
   ```bash
   pnpm version-packages
   ```
4. 全パッケージをビルドし、npm へ公開します。
   ```bash
   pnpm release
   ```
   `pnpm release` は `pnpm build`（ワークスペース全体のビルド）と `pnpm changeset publish` を順に実行します。MCP サーバ単体を手動で公開したい場合は `pnpm --filter @kajidog/connpass-mcp-server publish --access public` を利用できます。

公開前に `pnpm --filter @kajidog/connpass-mcp-server typecheck` で型チェック、`pnpm --filter @kajidog/connpass-mcp-server build` でビルドを確認しておくと安全です。

## ツール一覧

| ツール名 | 説明 | 主な入力フィールド |
| --- | --- | --- |
| `search_events` | 自然言語の日付やキーワードでイベントを検索 | `query`, `anyQuery`, `on`, `from`, `to`, `participantNickname`, `hostNickname`, `groupIds`, `prefectures`, `page`, `pageSize`, `sort` |
| `get_all_events` | フィルターに合致するイベントをすべて取得（ページング自動処理） | `search_events` と同じ（`page` / `pageSize` は無視） |
| `get_event_presentations` | 指定イベントの発表情報を取得 | `eventId` |
| `search_groups` | グループをキーワードや所在地で検索 | `query`, `groupIds`, `country`, `prefecture`, `page`, `pageSize`, `sort` |
| `get_all_groups` | 条件に合うグループをすべて取得（ページング自動処理） | `search_groups` と同じ（`page` / `pageSize` は無視） |
| `search_users` | ニックネームなどでユーザーを検索 | `nickname`, `userIds`, `page`, `pageSize`, `sort` |
| `get_user_groups` | 指定ユーザーが所属するグループ一覧 | `userId`, `limit`, `page` |
| `get_user_attended_events` | 指定ユーザーが参加したイベント一覧 | `userId`, `limit`, `page`, `sort` |
| `get_user_presenter_events` | 指定ユーザーが登壇したイベント一覧 | `userId`, `limit`, `page`, `sort` |
| `get_my_upcoming_events` | 今日と指定期間内のイベントを取得（自分の ID を自動使用可能） | `userId`, `daysAhead`, `maxEvents`, `includePresentations` |

## シンプルな使い方

### イベント検索（例）

```json
{
  "name": "search_events",
  "arguments": {
    "query": "React 勉強会",
    "from": "next Monday",
    "to": "next Friday",
    "prefectures": "東京都",
    "sort": "start-date-asc"
  }
}
```

- 日付は `"2024-05-01"` のような ISO 形式に加えて、`today` / `tomorrow` / `next Monday` などの自然言語も指定できます。
- `prefectures` や `on` は単一文字列でも配列でも指定可能です。

### グループ検索（例）

```json
{
  "name": "search_groups",
  "arguments": {
    "query": "AI",
    "country": "JP",
    "sort": "most-members"
  }
}
```

### ユーザーの登壇イベント取得（例）

```json
{
  "name": "get_user_presenter_events",
  "arguments": {
    "userId": 123456,
    "limit": 30,
    "sort": "newly-added"
  }
}
```

### 自分の今日・直近イベント取得（例）

```json
{
  "name": "get_my_upcoming_events",
  "arguments": {
    "daysAhead": 10,
    "includePresentations": true
  }
}
```

- `userId` を省略すると、`CONNPASS_DEFAULT_USER_ID` 環境変数が使われます。
- `includePresentations` を有効にすると、各イベントの発表詳細を個別に取得します（ Connpass API は 1 秒あたり 1 リクエストのレートリミットなので、イベント数が多いと時間がかかります）。省略時は `CONNPASS_INCLUDE_PRESENTATIONS_DEFAULT` の設定が利用されます。

## 返り値

各ツールは Connpass API v2 のレスポンスをそのまま返します。結果は JSON 配列で、イベント・グループ・ユーザーなどの詳細が含まれます。必要に応じてクライアント側で整形してください。

## 開発補助

- 型チェック: `pnpm --filter @kajidog/connpass-mcp-server typecheck`
- ウォッチビルド: `pnpm --filter @kajidog/connpass-mcp-server dev`

ツールの追加や更新を行った際は、`pnpm build` 実行後に README も更新して最新の引数仕様を反映するようにしてください。
