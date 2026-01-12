import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { openai } from '@ai-sdk/openai';
import {
  searchEventsTool,
  getEventDetailsTool,
  getUserScheduleTool,
  manageFeedTool,
} from '../tools/index.js';

/**
 * メモリ設定
 * - resource スコープ: ユーザー毎にワーキングメモリを保持
 * - lastMessages: 直近10件のメッセージを保持
 */
const storage = new LibSQLStore({
  url: process.env.DATABASE_URL || 'file:./agent-memory.db',
});

export const memory = new Memory({
  storage,
  options: {
    lastMessages: 10,
    workingMemory: {
      enabled: true,
      scope: 'resource',
      template: `# ユーザー情報
- Connpassニックネーム:
- よく検索するキーワード:
- 興味のある分野:
- よく参加するイベントの種類:
- 備考:
`,
    },
  },
});

/**
 * Connpassアシスタントエージェント
 * イベント検索、詳細確認、スケジュール管理、フィード設定をサポート
 */
export const connpassAgent = new Agent({
  name: 'Connpass Assistant',
  instructions: `あなたはConnpassイベントの検索・管理をサポートする日本語アシスタントです。

## あなたの役割
1. **イベント検索**: ユーザーの興味に合わせてイベントを探す
2. **イベント詳細**: 特定イベントの詳細情報を提供し、わかりやすく要約する
3. **スケジュール確認**: ユーザーの参加予定イベントを確認する
4. **フィード管理**: 定期通知の設定をサポートする

## Discord出力フォーマット
回答はDiscordに投稿されます。以下のフォーマットを使用してください：

- 見出しには **太字** を使用（##は使わない）
- リストは \`-\` を使用
- イベント名は **太字** で表示
- 日時は \`YYYY/MM/DD HH:mm\` 形式で表示
- リンクは [テキスト](URL) 形式

## イベント一覧の表示例
**検索結果: 3件**

- **[イベント名](URL)**
  📅 2025/01/20 19:00〜 | 📍 渋谷
  👥 30/50人 | 主催: xxx

## 注意事項
- 必ず日本語で回答してください
- ユーザーのワーキングメモリに興味や好みを記録し、次回以降の検索に活用してください
- イベントの詳細説明がHTMLの場合は、重要な情報を抽出して要約してください
- 参加費や持ち物など、参加者にとって重要な情報は必ず含めてください
`,
  model: openai('gpt-4o-mini'),
  tools: {
    searchEvents: searchEventsTool,
    getEventDetails: getEventDetailsTool,
    getUserSchedule: getUserScheduleTool,
    manageFeed: manageFeedTool,
  },
  memory,
});
