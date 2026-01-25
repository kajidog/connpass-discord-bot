/**
 * Feed実行ログビューアーコンポーネント
 */

import React from 'react';
import { Box, Text } from 'ink';
import { ActionType, type ActionLogRecord } from '@connpass-discord-bot/core';

interface FeedLogViewerProps {
  logs: ActionLogRecord[];
  isLoading?: boolean;
  error?: string;
}

/**
 * タイムスタンプをフォーマット
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * アクションタイプに応じたアイコンを取得
 */
function getActionIcon(actionType: ActionType): string {
  switch (actionType) {
    case ActionType.SCHEDULER_EXECUTE:
      return '';
    case ActionType.SCHEDULER_START:
      return '';
    case ActionType.SCHEDULER_STOP:
      return '';
    case ActionType.SCHEDULER_ERROR:
      return '';
    case ActionType.NOTIFY_SEND:
      return '';
    case ActionType.NOTIFY_ERROR:
      return '';
    case ActionType.SCHEDULE_CREATE:
      return '+';
    case ActionType.SCHEDULE_UPDATE:
      return '*';
    case ActionType.SCHEDULE_DELETE:
      return '-';
    case ActionType.AI_AGENT_START:
    case ActionType.AI_AGENT_END:
    case ActionType.AI_TOOL_CALL:
      return 'AI';
    case ActionType.AI_ERROR:
      return '!';
    default:
      return '-';
  }
}

/**
 * アクションタイプに応じた色を取得
 */
function getActionColor(actionType: ActionType): string {
  switch (actionType) {
    case ActionType.SCHEDULER_EXECUTE:
    case ActionType.NOTIFY_SEND:
      return 'green';
    case ActionType.SCHEDULER_START:
    case ActionType.SCHEDULE_CREATE:
      return 'cyan';
    case ActionType.SCHEDULER_STOP:
    case ActionType.SCHEDULE_DELETE:
      return 'yellow';
    case ActionType.SCHEDULER_ERROR:
    case ActionType.NOTIFY_ERROR:
    case ActionType.AI_ERROR:
      return 'red';
    case ActionType.SCHEDULE_UPDATE:
      return 'blue';
    case ActionType.AI_AGENT_START:
    case ActionType.AI_AGENT_END:
    case ActionType.AI_TOOL_CALL:
      return 'magenta';
    default:
      return 'gray';
  }
}

/**
 * アクションタイプのラベルを取得
 */
function getActionLabel(actionType: ActionType): string {
  switch (actionType) {
    case ActionType.SCHEDULER_EXECUTE:
      return 'Feed実行';
    case ActionType.SCHEDULER_START:
      return 'スケジューラー開始';
    case ActionType.SCHEDULER_STOP:
      return 'スケジューラー停止';
    case ActionType.SCHEDULER_ERROR:
      return 'スケジューラーエラー';
    case ActionType.NOTIFY_SEND:
      return '通知送信';
    case ActionType.NOTIFY_ERROR:
      return '通知エラー';
    case ActionType.SCHEDULE_CREATE:
      return 'スケジュール作成';
    case ActionType.SCHEDULE_UPDATE:
      return 'スケジュール更新';
    case ActionType.SCHEDULE_DELETE:
      return 'スケジュール削除';
    case ActionType.AI_AGENT_START:
      return 'AIエージェント開始';
    case ActionType.AI_AGENT_END:
      return 'AIエージェント終了';
    case ActionType.AI_TOOL_CALL:
      return 'AIツール呼び出し';
    case ActionType.AI_ERROR:
      return 'AIエラー';
    default:
      return actionType;
  }
}

export function FeedLogViewer({
  logs,
  isLoading,
  error,
}: FeedLogViewerProps): React.ReactElement {
  if (isLoading) {
    return (
      <Box>
        <Text color="gray">ログを読み込み中...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red">エラー: {error}</Text>
      </Box>
    );
  }

  if (logs.length === 0) {
    return (
      <Box>
        <Text color="gray">ログがありません</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">
        Feed実行ログ ({logs.length}件)
      </Text>
      <Box marginTop={1} flexDirection="column">
        {logs.map((log) => (
          <FeedLogEntry key={log.id} log={log} />
        ))}
      </Box>
    </Box>
  );
}

interface FeedLogEntryProps {
  log: ActionLogRecord;
}

function FeedLogEntry({ log }: FeedLogEntryProps): React.ReactElement {
  const icon = getActionIcon(log.actionType);
  const color = getActionColor(log.actionType);
  const label = getActionLabel(log.actionType);
  const timeStr = formatTimestamp(log.timestamp);

  return (
    <Box marginY={0}>
      <Text color="gray" dimColor>
        [{timeStr}]
      </Text>
      <Text> </Text>
      <Text color={color}>[{icon}]</Text>
      <Text> </Text>
      <Text color={color} bold>
        {label}
      </Text>
      <Text color="gray">: </Text>
      <Text>{log.message}</Text>
    </Box>
  );
}

/**
 * ログをフォーマットしてテキスト出力用に変換
 */
export function formatLogsAsText(logs: ActionLogRecord[]): string {
  if (logs.length === 0) {
    return 'ログがありません';
  }

  const lines = [`Feed実行ログ (${logs.length}件)`, ''];

  for (const log of logs) {
    const timeStr = formatTimestamp(log.timestamp);
    const label = getActionLabel(log.actionType);
    lines.push(`[${timeStr}] ${label}: ${log.message}`);
  }

  return lines.join('\n');
}
