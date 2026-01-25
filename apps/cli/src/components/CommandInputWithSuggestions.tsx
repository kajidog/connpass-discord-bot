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
            // 次のサジェストを選択状態に（連続Tabで次へ）
            setSelectedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
          }
        }
        return;
      }

      // 上下キー: 履歴ナビゲーション優先
      if (key.upArrow) {
        if (commandHistory.length > 0) {
          // 履歴ナビゲーション（上へ = 過去へ）
          if (historyIndex === -1) {
            // 現在の入力を保存
            savedCommand.current = command;
          }
          const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
          setHistoryIndex(newIndex);
          setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
          setShowSuggestions(false);
          // TextInputをリマウントしてカーソル位置を末尾に
          setInputKey((prev) => prev + 1);
        }
        return;
      }

      if (key.downArrow) {
        if (historyIndex > -1) {
          // 履歴ナビゲーション（下へ = 新しい方へ）
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          if (newIndex === -1) {
            setCommand(savedCommand.current);
          } else {
            setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
          }
          // TextInputをリマウントしてカーソル位置を末尾に
          setInputKey((prev) => prev + 1);
        }
        return;
      }
    },
    { isActive: !disabled && !isExecuting }
  );

  // コマンド変更
  const handleChange = useCallback((value: string) => {
    setCommand(value);
    setShowSuggestions(true);
    setSelectedIndex(0);
    setHistoryIndex(-1);
  }, []);

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
          <Text color="gray" dimColor>サジェスト (Tab: 選択)</Text>
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
            履歴 ({historyIndex + 1}/{commandHistory.length}) - ↑↓: 切替
          </Text>
        </Box>
      )}
    </Box>
  );
}
