/**
 * メインメニューコンポーネント
 * CLI起動時に表示するメインメニュー
 */

import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

export type MenuOption = 'discord' | 'config' | 'logs';

interface MainMenuProps {
    onSelect: (option: MenuOption) => void;
}

const menuItems = [
    { label: '🎮 Discordの設定', value: 'discord' as MenuOption },
    { label: '⚙️  現在の設定', value: 'config' as MenuOption },
    { label: '📋 ログの表示', value: 'logs' as MenuOption },
];

export function MainMenu({ onSelect }: MainMenuProps): React.ReactElement {
    const handleSelect = (item: { label: string; value: MenuOption }) => {
        onSelect(item.value);
    };

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold color="cyan">
                    ┌─────────────────────────────────────────┐
                </Text>
            </Box>
            <Box>
                <Text bold color="cyan">
                    │  Connpass Discord Bot CLI              │
                </Text>
            </Box>
            <Box marginBottom={1}>
                <Text bold color="cyan">
                    └─────────────────────────────────────────┘
                </Text>
            </Box>

            <Text bold color="yellow">メニューを選択してください:</Text>
            <Box marginTop={1}>
                <SelectInput items={menuItems} onSelect={handleSelect} />
            </Box>

            <Box marginTop={2}>
                <Text color="gray" dimColor>
                    ↑↓: 選択  Enter: 決定  Ctrl+C: 終了
                </Text>
            </Box>
        </Box>
    );
}
