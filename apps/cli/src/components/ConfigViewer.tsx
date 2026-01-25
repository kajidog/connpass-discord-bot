/**
 * 設定表示コンポーネント
 * 現在読み込まれている設定を詳細に表示
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';

interface ConfigItem {
    name: string;
    envVar: string;
    value: string;
    defaultValue?: string;
    type: 'string' | 'path' | 'url' | 'enum' | 'boolean';
    isSet: boolean;
    isRequired: boolean;
    options?: string[];  // enumの場合の選択肢
}

interface ConfigViewerProps {
    onBack?: () => void;
}

/**
 * 環境変数の値をマスク（機密情報用）
 */
function maskValue(value: string | undefined, showPartial = false): string {
    if (!value) return '';
    if (!showPartial) return '********';
    if (value.length <= 8) return '****';
    return value.slice(0, 4) + '****' + value.slice(-4);
}

/**
 * 環境変数から設定情報を収集
 */
function collectConfigItems(): ConfigItem[] {
    const env = process.env;

    const items: ConfigItem[] = [
        // Discord関連
        {
            name: 'Discord Bot Token',
            envVar: 'DISCORD_BOT_TOKEN',
            value: maskValue(env.DISCORD_BOT_TOKEN, true),
            type: 'string',
            isSet: !!env.DISCORD_BOT_TOKEN,
            isRequired: true,
        },
        {
            name: 'Discord Application ID',
            envVar: 'DISCORD_APPLICATION_ID',
            value: env.DISCORD_APPLICATION_ID || '',
            type: 'string',
            isSet: !!env.DISCORD_APPLICATION_ID,
            isRequired: false,
        },

        // AI関連
        {
            name: 'OpenAI API Key',
            envVar: 'OPENAI_API_KEY',
            value: maskValue(env.OPENAI_API_KEY, true),
            type: 'string',
            isSet: !!env.OPENAI_API_KEY,
            isRequired: false,
        },
        {
            name: 'Google AI API Key',
            envVar: 'GOOGLE_AI_API_KEY',
            value: maskValue(env.GOOGLE_AI_API_KEY, true),
            type: 'string',
            isSet: !!env.GOOGLE_AI_API_KEY,
            isRequired: false,
        },
        {
            name: 'Anthropic API Key',
            envVar: 'ANTHROPIC_API_KEY',
            value: maskValue(env.ANTHROPIC_API_KEY, true),
            type: 'string',
            isSet: !!env.ANTHROPIC_API_KEY,
            isRequired: false,
        },

        // データ保存
        {
            name: 'ストレージ種別',
            envVar: 'STORAGE_TYPE',
            value: env.STORAGE_TYPE || 'file',
            defaultValue: 'file',
            type: 'enum',
            isSet: !!env.STORAGE_TYPE,
            isRequired: false,
            options: ['file', 'sqlite'],
        },
        {
            name: 'データベースパス',
            envVar: 'DB_PATH',
            value: env.DB_PATH || './data/app.db',
            defaultValue: './data/app.db',
            type: 'path',
            isSet: !!env.DB_PATH,
            isRequired: false,
        },
        {
            name: 'DATABASE_URL',
            envVar: 'DATABASE_URL',
            value: env.DATABASE_URL || '',
            type: 'path',
            isSet: !!env.DATABASE_URL,
            isRequired: false,
        },
        {
            name: 'Redis URL',
            envVar: 'REDIS_URL',
            value: env.REDIS_URL || '',
            type: 'url',
            isSet: !!env.REDIS_URL,
            isRequired: false,
        },
        {
            name: 'Feed設定ディレクトリ',
            envVar: 'JOB_STORE_DIR',
            value: env.JOB_STORE_DIR || './data',
            defaultValue: './data',
            type: 'path',
            isSet: !!env.JOB_STORE_DIR,
            isRequired: false,
        },

        // ログ設定
        {
            name: 'ログレベル',
            envVar: 'LOG_LEVEL',
            value: env.LOG_LEVEL || 'INFO',
            defaultValue: 'INFO',
            type: 'enum',
            isSet: !!env.LOG_LEVEL,
            isRequired: false,
            options: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
        },
        {
            name: 'ログ出力先',
            envVar: 'LOG_DESTINATION',
            value: env.LOG_DESTINATION || 'console',
            defaultValue: 'console',
            type: 'enum',
            isSet: !!env.LOG_DESTINATION,
            isRequired: false,
            options: ['console', 'database', 'both'],
        },

        // スケジューラー
        {
            name: 'スケジューラー有効',
            envVar: 'SCHEDULER_ENABLED',
            value: env.SCHEDULER_ENABLED || 'true',
            defaultValue: 'true',
            type: 'boolean',
            isSet: !!env.SCHEDULER_ENABLED,
            isRequired: false,
            options: ['true', 'false'],
        },

        // Mastra関連
        {
            name: 'Mastra Server URL',
            envVar: 'MASTRA_SERVER_URL',
            value: env.MASTRA_SERVER_URL || '',
            type: 'url',
            isSet: !!env.MASTRA_SERVER_URL,
            isRequired: false,
        },
    ];

    return items;
}

export function ConfigViewer({ onBack }: ConfigViewerProps): React.ReactElement {
    const configItems = useMemo(() => collectConfigItems(), []);

    // カテゴリごとにグループ化
    const discordItems = configItems.filter(item =>
        item.envVar.startsWith('DISCORD')
    );
    const aiItems = configItems.filter(item =>
        item.envVar.includes('API_KEY') && !item.envVar.startsWith('DISCORD')
    );
    const dataItems = configItems.filter(item =>
        item.envVar.includes('DB') ||
        item.envVar.includes('REDIS') ||
        item.envVar.includes('JOB_STORE') ||
        item.envVar.includes('STORAGE') ||
        item.envVar.includes('DATABASE')
    );
    const logItems = configItems.filter(item =>
        item.envVar.startsWith('LOG')
    );
    const otherItems = configItems.filter(item =>
        !discordItems.includes(item) &&
        !aiItems.includes(item) &&
        !dataItems.includes(item) &&
        !logItems.includes(item)
    );

    // 統計
    const requiredItems = configItems.filter(i => i.isRequired);
    const requiredSetCount = requiredItems.filter(i => i.isSet).length;
    const optionalSetCount = configItems.filter(i => !i.isRequired && i.isSet).length;

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold color="yellow">⚙️  現在の設定</Text>
            </Box>

            {/* サマリー */}
            <Box marginBottom={1}>
                <Text color="gray">
                    必須: <Text color={requiredSetCount === requiredItems.length ? 'green' : 'red'}>{requiredSetCount}/{requiredItems.length}</Text>
                    {' | '}
                    任意: <Text color="cyan">{optionalSetCount}</Text> 件設定済み
                </Text>
            </Box>

            {/* 凡例 */}
            <Box marginBottom={1}>
                <Text color="gray" dimColor>
                    凡例: <Text color="green">●</Text> 設定済み  <Text color="yellow">○</Text> デフォルト  <Text color="red">✗</Text> 未設定(必須)  <Text color="gray">-</Text> 未設定
                </Text>
            </Box>

            <ConfigSection title="Discord" items={discordItems} />
            <ConfigSection title="AI" items={aiItems} />
            <ConfigSection title="データ保存" items={dataItems} />
            <ConfigSection title="ログ" items={logItems} />
            {otherItems.length > 0 && (
                <ConfigSection title="その他" items={otherItems} />
            )}

            <Box marginTop={2}>
                <Text color="gray" dimColor>
                    Esc: メニューに戻る  Ctrl+C: 終了
                </Text>
            </Box>
        </Box>
    );
}

interface ConfigSectionProps {
    title: string;
    items: ConfigItem[];
}

function ConfigSection({ title, items }: ConfigSectionProps): React.ReactElement {
    if (items.length === 0) return <></>;

    return (
        <Box flexDirection="column" marginBottom={1}>
            <Box marginBottom={0}>
                <Text bold color="cyan">
                    ▸ {title}
                </Text>
            </Box>
            {items.map((item) => (
                <ConfigItemRow key={item.envVar} item={item} />
            ))}
        </Box>
    );
}

interface ConfigItemRowProps {
    item: ConfigItem;
}

function ConfigItemRow({ item }: ConfigItemRowProps): React.ReactElement {
    // ステータスアイコン
    let statusIcon: string;
    let statusColor: string;

    if (item.isSet) {
        statusIcon = '●';
        statusColor = 'green';
    } else if (item.defaultValue) {
        statusIcon = '○';
        statusColor = 'yellow';
    } else if (item.isRequired) {
        statusIcon = '✗';
        statusColor = 'red';
    } else {
        statusIcon = '-';
        statusColor = 'gray';
    }

    // 表示する値
    const displayValue = item.value || item.defaultValue || '(未設定)';

    // デフォルト表示
    const isUsingDefault = !item.isSet && item.defaultValue;

    return (
        <Box flexDirection="column" marginLeft={2}>
            <Box>
                {/* ステータスアイコン */}
                <Box width={3}>
                    <Text color={statusColor as any}>{statusIcon}</Text>
                </Box>
                {/* 名前 */}
                <Box width={20}>
                    <Text color={item.isSet ? 'white' : 'gray'}>
                        {item.name}:
                    </Text>
                </Box>
                {/* 値 */}
                <Box width={25}>
                    <Text color={item.isSet ? 'green' : isUsingDefault ? 'yellow' : 'gray'}>
                        {displayValue}
                    </Text>
                </Box>
                {/* デフォルトまたは必須表示 */}
                <Box width={12}>
                    {isUsingDefault && (
                        <Text color="yellow" dimColor>(default)</Text>
                    )}
                    {item.isRequired && !item.isSet && (
                        <Text color="red">(必須)</Text>
                    )}
                </Box>
                {/* 環境変数名 */}
                <Text color="gray" dimColor>
                    {item.envVar}
                </Text>
            </Box>
            {/* オプション（enumの場合） */}
            {item.options && (
                <Box marginLeft={3}>
                    <Text color="gray" dimColor>
                        選択肢: {item.options.map((opt, i) => (
                            <Text key={opt} color={opt === displayValue ? 'cyan' : 'gray'}>
                                {i > 0 ? ', ' : ''}{opt}
                            </Text>
                        ))}
                    </Text>
                </Box>
            )}
        </Box>
    );
}
