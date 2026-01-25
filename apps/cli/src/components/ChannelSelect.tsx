/**
 * チャンネル選択コンポーネント
 */

import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { TextChannel } from 'discord.js';

interface ChannelSelectProps {
    channels: TextChannel[];
    onSelect: (channel: TextChannel) => void;
}

export function ChannelSelect({ channels, onSelect }: ChannelSelectProps): React.ReactElement {
    const items = channels.map((channel) => ({
        label: `#${channel.name}`,
        value: channel.id,
    }));

    const handleSelect = (item: { label: string; value: string }) => {
        const channel = channels.find((c) => c.id === item.value);
        if (channel) {
            onSelect(channel);
        }
    };

    return (
        <Box flexDirection="column">
            <Text bold color="yellow">📺 チャンネルを選択:</Text>
            <Box marginTop={1}>
                <SelectInput items={items} onSelect={handleSelect} />
            </Box>
        </Box>
    );
}
