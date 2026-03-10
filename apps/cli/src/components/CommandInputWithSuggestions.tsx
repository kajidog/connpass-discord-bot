/**
 * サジェスト付きコマンド入力コンポーネント
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { CommandResponse } from '@connpass-discord-bot/core';
import { filterSuggestions, getCommandDescription } from '../constants/commands.js';

interface CommandInputWithSuggestionsProps {
  channelId: string;
  onExecute: (command: string) => Promise<CommandResponse>;
  disabled?: boolean;
}

export function CommandInputWithSuggestions({
  channelId,
  onExecute,
  disabled = false,
}: CommandInputWithSuggestionsProps): React.ReactElement {
  const [command, setCommand] = useState('/connpass feed ');
  const [isExecuting, setIsExecuting] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // TextInputのリマウント用キー（カーソル位置をリセットするため）
  const [inputKey, setInputKey] = useState(0);

  // カーソル位置トラッキング（ink-text-inputは外部に公開しないため自前で管理）
  const cursorPosition = useRef<number>('/connpass feed '.length);

  // コマンド履歴
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const savedCommand = useRef<string>('');

  // フィルタリングされたサジェスト
  const suggestions = useMemo(() => filterSuggestions(command), [command]);

  // キー入力ハンドリング
  useInput(
    (input, key) => {
      if (disabled || isExecuting) return;

      // Tab: サジェスト選択を適用 / サジェスト内を移動
      if (key.tab) {
        if (suggestions.length > 0 && showSuggestions) {
          // Shift+Tab: 前のサジェストへ
          if (key.shift) {
            setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          } else {
            // Tab: 現在のサジェストを適用
            const selected = suggestions[selectedIndex];
            setCommand(selected);
            setShowSuggestions(false);
            // 履歴操作をリセット
            setHistoryIndex(-1);
            // TextInputをリマウントしてカーソル位置を末尾に
            setInputKey((prev) => prev + 1);
            cursorPosition.current = selected.length;
            // 次のサジェストを選択状態に（連続Tabで次へ）
            setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
          }
        }
        return;
      }

      // 左右矢印: カーソル位置をトラッキング
      if (key.leftArrow) {
        cursorPosition.current = Math.max(0, cursorPosition.current - 1);
        return;
      }
      if (key.rightArrow) {
        cursorPosition.current = Math.min(command.length, cursorPosition.current + 1);
        return;
      }

      // 上下キー: カーソルが先頭にあるときは履歴、それ以外はサジェスト候補の切り替え
      if (key.upArrow) {
        if (cursorPosition.current === 0) {
          // カーソルが先頭 → 履歴ナビゲーション（上へ = 過去へ）
          if (commandHistory.length > 0) {
            if (historyIndex === -1) {
              savedCommand.current = command;
            }
            const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
            setHistoryIndex(newIndex);
            const newCommand = commandHistory[commandHistory.length - 1 - newIndex];
            setCommand(newCommand);
            setShowSuggestions(false);
            setInputKey((prev) => prev + 1);
            cursorPosition.current = 0;
          }
        } else if (showSuggestions && suggestions.length > 0) {
          // カーソルが先頭以外 → サジェスト候補を上に移動
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        }
        return;
      }

      if (key.downArrow) {
        if (cursorPosition.current === 0 && historyIndex > -1) {
          // カーソルが先頭 → 履歴ナビゲーション（下へ = 新しい方へ）
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          let newCommand: string;
          if (newIndex === -1) {
            newCommand = savedCommand.current;
          } else {
            newCommand = commandHistory[commandHistory.length - 1 - newIndex];
          }
          setCommand(newCommand);
          setInputKey((prev) => prev + 1);
          cursorPosition.current = 0;
        } else if (showSuggestions && suggestions.length > 0) {
          // カーソルが先頭以外 → サジェスト候補を下に移動
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        }
        return;
      }
    },
    { isActive: !disabled && !isExecuting }
  );

  // コマンド変更
  const handleChange = useCallback((value: string) => {
    // カーソル位置を差分から推定して更新
    const lengthDiff = value.length - command.length;
    cursorPosition.current = Math.max(0, cursorPosition.current + lengthDiff);
    setCommand(value);
    setShowSuggestions(true);
    setSelectedIndex(0);
    setHistoryIndex(-1);
  }, [command]);

  // コマンド実行
  const handleSubmit = useCallback(
    async (value: string) => {
      if (!value.trim() || isExecuting) return;

      setIsExecuting(true);
      setShowSuggestions(false);

      // 履歴に追加（重複を避ける）
      const trimmedValue = value.trim();
      setCommandHistory((prev) => {
        const filtered = prev.filter((cmd) => cmd !== trimmedValue);
        return [...filtered, trimmedValue];
      });
      setHistoryIndex(-1);

      try {
        await onExecute(trimmedValue);
      } finally {
        setIsExecuting(false);
        setCommand('/connpass feed ');
      }
    },
    [onExecute, isExecuting]
  );

  return (
    <Box flexDirection="column">
      {/* 入力欄 */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
      >
        {isExecuting ? (
          <Box>
            <Text color="green">
              <Spinner type="dots" />
            </Text>
            <Text> 実行中...</Text>
          </Box>
        ) : (
          <Box>
            <Text color="cyan" bold>{'> '}</Text>
            <TextInput
              key={inputKey}
              value={command}
              onChange={handleChange}
              onSubmit={handleSubmit}
              placeholder="/connpass feed status"
              focus={!disabled}
            />
          </Box>
        )}
      </Box>

      {/* サジェスト表示 */}
      {!isExecuting && showSuggestions && suggestions.length > 0 && (
        <Box
          flexDirection="column"
          marginTop={0}
          marginLeft={1}
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          <Text color="gray" dimColor>サジェスト (↑↓/Tab: 選択)</Text>
          {suggestions.slice(0, 5).map((suggestion, index) => {
            const isSelected = index === selectedIndex;
            const description = getCommandDescription(suggestion);
            return (
              <Box key={suggestion}>
                <Text
                  color={isSelected ? 'cyan' : 'gray'}
                  bold={isSelected}
                  dimColor={!isSelected}
                  inverse={isSelected}
                >
                  {isSelected ? ' > ' : '   '}
                  {suggestion}
                  {isSelected ? ' ' : ''}
                </Text>
                {description && (
                  <Text color="gray" dimColor>
                    {' '}
                    - {description}
                  </Text>
                )}
              </Box>
            );
          })}
          {suggestions.length > 5 && (
            <Text color="gray" dimColor>
              {`   ... 他 ${suggestions.length - 5} 件`}
            </Text>
          )}
        </Box>
      )}

      {/* 履歴モード表示 */}
      {!isExecuting && historyIndex > -1 && (
        <Box marginLeft={1}>
          <Text color="gray" dimColor>
            履歴 ({historyIndex + 1}/{commandHistory.length}) - 先頭で↑↓: 切替
          </Text>
        </Box>
      )}
    </Box>
  );
}
