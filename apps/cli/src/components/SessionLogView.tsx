/**
 * セッションログ表示コンポーネント
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';

export type LogEntryType = 'command' | 'result' | 'error' | 'info';

export interface SessionLogEntry {
  id: string;
  timestamp: number;
  type: LogEntryType;
  content: string;
}

interface SessionLogViewProps {
  logs: SessionLogEntry[];
  maxVisible?: number;
  scrollOffset?: number;
}

/**
 * タイムスタンプをフォーマット
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * ログタイプに応じた色を取得
 */
function getLogColor(type: LogEntryType): string {
  switch (type) {
    case 'command':
      return 'cyan';
    case 'result':
      return 'green';
    case 'error':
      return 'red';
    case 'info':
      return 'yellow';
    default:
      return 'white';
  }
}

/**
 * ログタイプに応じたプレフィックスを取得
 */
function getLogPrefix(type: LogEntryType): string {
  switch (type) {
    case 'command':
      return '>';
    case 'result':
      return '';
    case 'error':
      return '';
    case 'info':
      return '';
    default:
      return '';
  }
}

export function SessionLogView({
  logs,
  maxVisible = 10,
  scrollOffset = 0,
}: SessionLogViewProps): React.ReactElement {
  // 表示するログを計算
  const { visibleLogs, hiddenAbove, hiddenBelow } = useMemo(() => {
    const total = logs.length;
    const startIndex = Math.max(0, total - maxVisible - scrollOffset);
    const endIndex = total - scrollOffset;

    const visible = logs.slice(startIndex, endIndex);
    const above = startIndex;
    const below = scrollOffset;

    return {
      visibleLogs: visible,
      hiddenAbove: above,
      hiddenBelow: below,
    };
  }, [logs, maxVisible, scrollOffset]);

  if (logs.length === 0) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color="gray" dimColor>
          コマンドを入力してください...
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {/* 上に隠れているログがある場合の表示 */}
      {hiddenAbove > 0 && (
        <Box marginBottom={1}>
          <Text color="gray" dimColor>
            --- {hiddenAbove} 件の古いログ (Shift+Up でスクロール) ---
          </Text>
        </Box>
      )}

      {/* ログエントリ */}
      {visibleLogs.map((log) => (
        <LogEntryView key={log.id} entry={log} />
      ))}

      {/* 下に隠れているログがある場合の表示 */}
      {hiddenBelow > 0 && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            --- {hiddenBelow} 件の新しいログ (Shift+Down でスクロール) ---
          </Text>
        </Box>
      )}
    </Box>
  );
}

interface LogEntryViewProps {
  entry: SessionLogEntry;
}

function LogEntryView({ entry }: LogEntryViewProps): React.ReactElement {
  const timeStr = formatTime(entry.timestamp);
  const color = getLogColor(entry.type);
  const prefix = getLogPrefix(entry.type);

  // 複数行のコンテンツを処理
  const lines = entry.content.split('\n');

  return (
    <Box flexDirection="column" marginY={0}>
      {lines.map((line, index) => (
        <Box key={index}>
          {index === 0 ? (
            <>
              <Text color="gray" dimColor>
                [{timeStr}]
              </Text>
              <Text> </Text>
              {prefix && (
                <Text color={color} bold>
                  {prefix}{' '}
                </Text>
              )}
              <Text color={color}>{line}</Text>
            </>
          ) : (
            <>
              <Text color="gray" dimColor>
                {'        '}
              </Text>
              <Text color={color}>{line}</Text>
            </>
          )}
        </Box>
      ))}
    </Box>
  );
}

/**
 * 新しいログエントリを作成するヘルパー
 */
export function createLogEntry(
  type: LogEntryType,
  content: string
): SessionLogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    type,
    content,
  };
}
