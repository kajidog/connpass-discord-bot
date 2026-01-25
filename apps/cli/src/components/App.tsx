/**
 * メインアプリケーションコンポーネント
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { Client, GatewayIntentBits, type Guild, type TextChannel } from 'discord.js';
import { ServerSelect } from './ServerSelect.js';
import { ChannelSelect } from './ChannelSelect.js';
import { CommandInput } from './CommandInput.js';
import { ResultDisplay } from './ResultDisplay.js';
import type { CommandResponse } from '@connpass-discord-bot/core';

type AppState = 'loading' | 'server-select' | 'channel-select' | 'command' | 'result' | 'error';

export function App(): React.ReactElement {
    const { exit } = useApp();
    const [state, setState] = useState<AppState>('loading');
    const [client, setClient] = useState<Client | null>(null);
    const [guilds, setGuilds] = useState<Guild[]>([]);
    const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
    const [channels, setChannels] = useState<TextChannel[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<TextChannel | null>(null);
    const [commandResult, setCommandResult] = useState<CommandResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Ctrl+C でアプリ終了
    useInput((input, key) => {
        if (key.ctrl && input === 'c') {
            if (client) {
                client.destroy();
            }
            exit();
        }
        // Escで前の画面に戻る
        if (key.escape) {
            if (state === 'channel-select') {
                setState('server-select');
            } else if (state === 'command') {
                setState('channel-select');
            } else if (state === 'result') {
                setState('command');
                setCommandResult(null);
            }
        }
    });

    // Discord クライアント初期化
    useEffect(() => {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            setError('DISCORD_BOT_TOKEN が設定されていません');
            setState('error');
            return;
        }

        const discordClient = new Client({
            intents: [GatewayIntentBits.Guilds],
        });

        discordClient.once('ready', () => {
            const guildList = Array.from(discordClient.guilds.cache.values());
            setGuilds(guildList);
            setClient(discordClient);
            setState('server-select');
        });

        discordClient.on('error', (err) => {
            setError(`Discord接続エラー: ${err.message}`);
            setState('error');
        });

        discordClient.login(token).catch((err) => {
            setError(`ログイン失敗: ${err.message}`);
            setState('error');
        });

        return () => {
            discordClient.destroy();
        };
    }, []);

    // サーバー選択
    const handleServerSelect = useCallback((guild: Guild) => {
        setSelectedGuild(guild);
        const textChannels = Array.from(guild.channels.cache.values())
            .filter((ch): ch is TextChannel => ch.isTextBased() && !ch.isThread() && !ch.isDMBased())
            .sort((a, b) => a.position - b.position);
        setChannels(textChannels);
        setState('channel-select');
    }, []);

    // チャンネル選択
    const handleChannelSelect = useCallback((channel: TextChannel) => {
        setSelectedChannel(channel);
        setState('command');
    }, []);

    // コマンド実行結果
    const handleCommandResult = useCallback((result: CommandResponse) => {
        setCommandResult(result);
        setState('result');
    }, []);

    // 結果画面から戻る
    const handleBackToCommand = useCallback(() => {
        setCommandResult(null);
        setState('command');
    }, []);

    return (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1}>
                <Text bold color="cyan">📦 Connpass Discord Bot CLI</Text>
                {selectedGuild && (
                    <Text color="gray"> / {selectedGuild.name}</Text>
                )}
                {selectedChannel && (
                    <Text color="gray"> / #{selectedChannel.name}</Text>
                )}
            </Box>

            {state === 'loading' && (
                <Box>
                    <Text color="green">
                        <Spinner type="dots" />
                    </Text>
                    <Text> Discord に接続中...</Text>
                </Box>
            )}

            {state === 'error' && (
                <Box flexDirection="column">
                    <Text color="red">❌ エラー: {error}</Text>
                    <Text color="gray" dimColor>Press Ctrl+C to exit</Text>
                </Box>
            )}

            {state === 'server-select' && (
                <ServerSelect
                    guilds={guilds}
                    onSelect={handleServerSelect}
                />
            )}

            {state === 'channel-select' && (
                <ChannelSelect
                    channels={channels}
                    onSelect={handleChannelSelect}
                />
            )}

            {state === 'command' && selectedChannel && (
                <CommandInput
                    channelId={selectedChannel.id}
                    onResult={handleCommandResult}
                />
            )}

            {state === 'result' && commandResult && (
                <ResultDisplay
                    result={commandResult}
                    onBack={handleBackToCommand}
                />
            )}

            <Box marginTop={1}>
                <Text color="gray" dimColor>
                    {state === 'command'
                        ? 'Enter: 実行 | Esc: チャンネル選択に戻る | Ctrl+C: 終了'
                        : state === 'result'
                            ? 'Esc: コマンド入力に戻る | Ctrl+C: 終了'
                            : 'Esc: 戻る | Ctrl+C: 終了'}
                </Text>
            </Box>
        </Box>
    );
}
