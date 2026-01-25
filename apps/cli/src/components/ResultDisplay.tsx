/**
 * 結果表示コンポーネント
 */

import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { CommandResponse } from '@connpass-discord-bot/core';

interface ResultDisplayProps {
    result: CommandResponse;
    onBack: () => void;
}

export function ResultDisplay({ result, onBack }: ResultDisplayProps): React.ReactElement {
    // Enterで戻る
    useInput((input, key) => {
        if (key.return) {
            onBack();
        }
    });

    // Markdownの太字（**text**）を解除して表示
    const formatContent = (content: string): string => {
        return content.replace(/\*\*([^*]+)\*\*/g, '$1');
    };

    return (
        <Box flexDirection="column">
            <Text bold color={result.ephemeral ? 'yellow' : 'green'}>
                {result.ephemeral ? '⚠️ 結果 (ephemeral):' : '✅ 結果:'}
            </Text>

            <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="gray" padding={1}>
                {formatContent(result.content).split('\n').map((line, i) => (
                    <Text key={i}>{line}</Text>
                ))}
            </Box>

            <Box marginTop={1}>
                <Text color="gray" dimColor>
                    Press Enter or Esc to continue...
                </Text>
            </Box>
        </Box>
    );
}
