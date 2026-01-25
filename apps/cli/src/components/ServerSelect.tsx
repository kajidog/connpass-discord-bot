/**
 * サーバー選択コンポーネント
 */

import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { Guild } from 'discord.js';

interface ServerSelectProps {
    guilds: Guild[];
    onSelect: (guild: Guild) => void;
}

export function ServerSelect({ guilds, onSelect }: ServerSelectProps): React.ReactElement {
    const items = guilds.map((guild) => ({
        label: guild.name,
        value: guild.id,
    }));

    const handleSelect = (item: { label: string; value: string }) => {
        const guild = guilds.find((g) => g.id === item.value);
        if (guild) {
            onSelect(guild);
        }
    };

    return (
        <Box flexDirection="column">
            <Text bold color="yellow">🏠 サーバーを選択:</Text>
            <Box marginTop={1}>
                <SelectInput items={items} onSelect={handleSelect} />
            </Box>
        </Box>
    );
}
