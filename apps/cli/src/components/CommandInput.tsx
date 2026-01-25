/**
 * コマンド入力コンポーネント
 */

import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { CommandResponse } from '@connpass-discord-bot/core';
import { executeCommand } from '../adapter/cli-adapter.js';

interface CommandInputProps {
    channelId: string;
    onResult: (result: CommandResponse) => void;
}

export function CommandInput({ channelId, onResult }: CommandInputProps): React.ReactElement {
    const [command, setCommand] = useState('/connpass feed ');
    const [isExecuting, setIsExecuting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = useCallback(async (value: string) => {
        if (!value.trim()) return;

        setIsExecuting(true);
        setError(null);

        try {
            const result = await executeCommand(value.trim(), channelId);
            onResult(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsExecuting(false);
        }
    }, [channelId, onResult]);

    return (
        <Box flexDirection="column">
            <Text bold color="yellow">⌨️ コマンドを入力:</Text>
            <Text color="gray" dimColor>
                例: /connpass feed status, /connpass feed set schedule:0 9 * * *
            </Text>

            <Box marginTop={1}>
                {isExecuting ? (
                    <Box>
                        <Text color="green">
                            <Spinner type="dots" />
                        </Text>
                        <Text> 実行中...</Text>
                    </Box>
                ) : (
                    <Box>
                        <Text color="cyan">{'> '}</Text>
                        <TextInput
                            value={command}
                            onChange={setCommand}
                            onSubmit={handleSubmit}
                            placeholder="/connpass feed status"
                        />
                    </Box>
                )}
            </Box>

            {error && (
                <Box marginTop={1}>
                    <Text color="red">❌ エラー: {error}</Text>
                </Box>
            )}

            <Box marginTop={1}>
                <Text color="gray" dimColor>
                    対応コマンド: /connpass feed set|status|remove
                </Text>
            </Box>
        </Box>
    );
}
