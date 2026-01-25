/**
 * システムログビューアーコンポーネント
 * リアルタイムでログを表示し、フィルタリング機能を提供
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import {
    LogLevel,
    logLevelToString,
    type InMemoryLogEntry,
    type InMemoryLogWriter,
} from '@connpass-discord-bot/core';

interface SystemLogViewerProps {
    logWriter: InMemoryLogWriter;
    maxVisible?: number;
}

const LOG_LEVELS = [
    { level: LogLevel.DEBUG, label: 'DEBUG', color: 'gray' },
    { level: LogLevel.INFO, label: 'INFO', color: 'blue' },
    { level: LogLevel.WARN, label: 'WARN', color: 'yellow' },
    { level: LogLevel.ERROR, label: 'ERROR', color: 'red' },
];

function getLogColor(level: LogLevel): string {
    switch (level) {
        case LogLevel.DEBUG:
            return 'gray';
        case LogLevel.INFO:
            return 'blue';
        case LogLevel.WARN:
            return 'yellow';
        case LogLevel.ERROR:
            return 'red';
        default:
            return 'white';
    }
}

function formatTimestamp(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

export function SystemLogViewer({
    logWriter,
    maxVisible = 15,
}: SystemLogViewerProps): React.ReactElement {
    const [logs, setLogs] = useState<InMemoryLogEntry[]>([]);
    const [filterLevel, setFilterLevel] = useState<LogLevel>(LogLevel.DEBUG);
    const [filterKeyword, setFilterKeyword] = useState('');
    const [isEditingFilter, setIsEditingFilter] = useState(false);
    const [scrollOffset, setScrollOffset] = useState(0);

    // ログの更新を監視
    useEffect(() => {
        const updateLogs = () => {
            const newLogs = logWriter.getAllLogs({
                level: filterLevel,
                keyword: filterKeyword || undefined,
            });
            setLogs(newLogs);
        };

        // 初回読み込み
        updateLogs();

        // リスナー登録
        const unsubscribe = logWriter.addListener(updateLogs);

        return unsubscribe;
    }, [logWriter, filterLevel, filterKeyword]);

    // フィルタリング済みログ
    const filteredLogs = useMemo(() => {
        return logs;
    }, [logs]);

    // 表示するログを計算
    const visibleLogs = useMemo(() => {
        const total = filteredLogs.length;
        const startIndex = Math.max(0, total - maxVisible - scrollOffset);
        const endIndex = total - scrollOffset;
        return filteredLogs.slice(startIndex, endIndex);
    }, [filteredLogs, maxVisible, scrollOffset]);

    const canScrollUp = filteredLogs.length > maxVisible && scrollOffset < filteredLogs.length - maxVisible;
    const canScrollDown = scrollOffset > 0;

    // キー入力ハンドリング
    useInput((input, key) => {
        if (isEditingFilter) {
            if (key.escape || key.return) {
                setIsEditingFilter(false);
            }
            return;
        }

        // フィルター編集モード開始
        if (input === '/') {
            setIsEditingFilter(true);
            return;
        }

        // ログレベル切り替え（Tab）
        if (key.tab) {
            setFilterLevel((current) => {
                const currentIndex = LOG_LEVELS.findIndex(l => l.level === current);
                const nextIndex = (currentIndex + 1) % LOG_LEVELS.length;
                return LOG_LEVELS[nextIndex].level;
            });
            setScrollOffset(0);
            return;
        }

        // スクロール（Shift + 矢印）
        if (key.shift) {
            if (key.upArrow && canScrollUp) {
                setScrollOffset((prev) => Math.min(prev + 1, filteredLogs.length - maxVisible));
            } else if (key.downArrow && canScrollDown) {
                setScrollOffset((prev) => Math.max(prev - 1, 0));
            }
        }

        // フィルタークリア（Backspace）
        if (key.backspace || key.delete) {
            setFilterKeyword('');
            setScrollOffset(0);
        }
    }, { isActive: true });

    const handleFilterChange = useCallback((value: string) => {
        setFilterKeyword(value);
        setScrollOffset(0);
    }, []);

    const logCount = logWriter.getCount();
    const currentLevelInfo = LOG_LEVELS.find(l => l.level === filterLevel) || LOG_LEVELS[1];

    return (
        <Box flexDirection="column">
            {/* ヘッダー */}
            <Box marginBottom={1}>
                <Text bold color="yellow">📋 システムログ</Text>
                <Text color="gray"> ({filteredLogs.length}/{logCount.total}件)</Text>
            </Box>

            {/* フィルター表示 */}
            <Box marginBottom={1}>
                <Box marginRight={2}>
                    <Text color="gray">レベル: </Text>
                    <Text color={currentLevelInfo.color as any} bold>
                        {currentLevelInfo.label}
                    </Text>
                    <Text color="gray" dimColor> (Tab: 切替)</Text>
                </Box>
                <Box>
                    <Text color="gray">検索: </Text>
                    {isEditingFilter ? (
                        <Box>
                            <Text color="cyan">/</Text>
                            <TextInput
                                value={filterKeyword}
                                onChange={handleFilterChange}
                                placeholder="キーワード..."
                            />
                        </Box>
                    ) : (
                        <Text color={filterKeyword ? 'cyan' : 'gray'}>
                            {filterKeyword || '(なし)'}
                        </Text>
                    )}
                    <Text color="gray" dimColor> (/: 編集)</Text>
                </Box>
            </Box>

            {/* ログ表示エリア */}
            <Box
                flexDirection="column"
                borderStyle="single"
                borderColor="gray"
                paddingX={1}
                paddingY={0}
            >
                {/* 上スクロールインジケーター */}
                {canScrollUp && (
                    <Text color="gray" dimColor>
                        ▲ {filteredLogs.length - maxVisible - scrollOffset} 件の古いログ
                    </Text>
                )}

                {/* ログエントリ */}
                {visibleLogs.length === 0 ? (
                    <Text color="gray" dimColor>
                        ログがありません
                    </Text>
                ) : (
                    visibleLogs.map((log) => (
                        <LogEntryView key={log.id} log={log} />
                    ))
                )}

                {/* 下スクロールインジケーター */}
                {canScrollDown && (
                    <Text color="gray" dimColor>
                        ▼ {scrollOffset} 件の新しいログ
                    </Text>
                )}
            </Box>

            {/* ヘルプ */}
            <Box marginTop={1}>
                <Text color="gray" dimColor>
                    Tab: レベル切替  /: 検索  Shift+↑↓: スクロール  Backspace: フィルタークリア  Esc: 戻る
                </Text>
            </Box>
        </Box>
    );
}

interface LogEntryViewProps {
    log: InMemoryLogEntry;
}

function LogEntryView({ log }: LogEntryViewProps): React.ReactElement {
    const timeStr = formatTimestamp(log.timestamp);
    const levelStr = logLevelToString(log.level);
    const color = getLogColor(log.level);

    return (
        <Box>
            <Text color="gray" dimColor>
                [{timeStr}]
            </Text>
            <Text> </Text>
            <Box width={7}>
                <Text color={color as any} bold>
                    [{levelStr}]
                </Text>
            </Box>
            <Text> </Text>
            <Box width={12}>
                <Text color="cyan" dimColor>
                    [{log.component}]
                </Text>
            </Box>
            <Text> </Text>
            <Text color={color as any}>{log.message}</Text>
        </Box>
    );
}
