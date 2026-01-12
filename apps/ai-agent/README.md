# AI Agent

Mastraフレームワークを使用したConnpass AIエージェント。

## 概要

Discord Botにメンションすることで、AIアシスタントと会話しながらConnpassイベントを検索・管理できます。

## 機能

### 1. イベント検索
キーワード、日付、場所などでイベントを検索

```
@Bot 来週の東京でのTypeScriptイベントを探して
```

### 2. イベント詳細確認
イベントIDを指定して詳細情報を取得

```
@Bot イベント123456の詳細を教えて
```

### 3. スケジュール確認
ユーザーの参加予定イベントを確認

```
@Bot 私の今月の参加予定を教えて
```

### 4. フィード管理
定期通知の設定をサポート

```
@Bot このチャンネルのフィード設定を確認して
```

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. 環境変数の設定

```env
# OpenAI API Key（必須）
OPENAI_API_KEY=sk-...

# データベースURL（オプション、デフォルトはfile:./agent-memory.db）
DATABASE_URL=file:./agent-memory.db

# Mastraストレージ（オプション）
MASTRA_STORAGE_URL=:memory:

# ログレベル（オプション）
LOG_LEVEL=info
```

### 3. 開発サーバーの起動

```bash
pnpm dev
```

## 構成

```
src/mastra/
├── index.ts              # Mastraインスタンス
├── agents/
│   └── connpass-agent.ts # Connpassエージェント
└── tools/
    ├── index.ts
    ├── search-events.ts     # イベント検索
    ├── get-event-details.ts # 詳細取得
    ├── get-user-schedule.ts # スケジュール確認
    └── manage-feed.ts       # フィード管理
```

## メモリ設定

Mastra Memoryを使用してユーザー情報を記憶します。

- **resource スコープ**: ユーザー毎にワーキングメモリを保持
- **thread スコープ**: 会話毎のメッセージ履歴

```typescript
const memory = new Memory({
  storage: new LibSQLStore({ url: 'file:./agent-memory.db' }),
  options: {
    lastMessages: 10,
    workingMemory: {
      enabled: true,
      scope: 'resource',
      template: `# ユーザー情報
- Connpassニックネーム:
- よく検索するキーワード:
- 興味のある分野:
`,
    },
  },
});
```

## ツール

### search-events
Connpass APIでイベントを検索

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| keyword | string? | 検索キーワード |
| prefecture | string? | 都道府県 |
| ymdFrom | string? | 開始日（YYYY-MM-DD） |
| ymdTo | string? | 終了日（YYYY-MM-DD） |
| count | number? | 取得件数（1-30） |

### get-event-details
イベントIDから詳細情報を取得

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| eventId | number | イベントID |

### get-user-schedule
ユーザーの参加予定イベントを取得

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| nickname | string? | Connpassニックネーム |
| daysAhead | number? | 何日先まで（1-90） |

### manage-feed
フィード設定を管理

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| action | string | status/create/update/delete |
| channelId | string? | チャンネルID |
| config | object? | フィード設定 |

## Discord Bot連携

Discord Botでは、このエージェントをメンションハンドラーで使用します。

```typescript
import { connpassAgent } from './agent/connpass-agent.js';

// メンション時にエージェントを実行
const response = await connpassAgent.generate(message.content, {
  runtimeContext,
  memory: { resource: userId, thread: channelId },
});
```

## 参考

- [Mastra Documentation](https://mastra.ai/docs)
- [Connpass API](https://connpass.com/about/api/)
