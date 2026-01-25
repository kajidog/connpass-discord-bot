/**
 * ステータスバーコンポーネント
 */

import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  hints: string[];
}

export function StatusBar({ hints }: StatusBarProps): React.ReactElement {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginTop={1}
    >
      <Text color="gray" dimColor>
        {hints.join(' | ')}
      </Text>
    </Box>
  );
}

/**
 * アプリ状態に応じたヒントを生成
 */
export function getStatusHints(
  state: string,
  options?: {
    hasLogs?: boolean;
    canScrollUp?: boolean;
    canScrollDown?: boolean;
  }
): string[] {
  const baseHints: string[] = [];

  switch (state) {
    case 'loading':
      baseHints.push('Ctrl+C: 終了');
      break;
    case 'server-select':
      baseHints.push('Enter: 選択', 'Ctrl+C: 終了');
      break;
    case 'channel-select':
      baseHints.push('Enter: 選択', 'Esc: 戻る', 'Ctrl+C: 終了');
      break;
    case 'command':
      baseHints.push('Tab: 補完', '↑↓: 履歴', 'Enter: 実行', 'Esc: 戻る');
      if (options?.hasLogs && (options.canScrollUp || options.canScrollDown)) {
        baseHints.push('Shift+↑↓: スクロール');
      }
      baseHints.push('Ctrl+C: 終了');
      break;
    case 'error':
      baseHints.push('Ctrl+C: 終了');
      break;
    default:
      baseHints.push('Ctrl+C: 終了');
  }

  return baseHints;
}
