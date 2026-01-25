/**
 * メインアプリケーションコンポーネント
 * メインメニューから3つの機能を選択可能
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import { Client, GatewayIntentBits, type Guild, type TextChannel } from 'discord.js';
import { Logger, InMemoryLogWriter } from '@connpass-discord-bot/core';
import { MainMenu, type MenuOption } from './MainMenu.js';
import { ServerSelect } from './ServerSelect.js';
import { ChannelSelect } from './ChannelSelect.js';
import { CommandInputWithSuggestions } from './CommandInputWithSuggestions.js';
import { Header } from './Header.js';
import { StatusBar, getStatusHints } from './StatusBar.js';
import { ConfigViewer } from './ConfigViewer.js';
import { SystemLogViewer } from './SystemLogViewer.js';
import {
  SessionLogView,
  createLogEntry,
  type SessionLogEntry,
} from './SessionLogView.js';
import type { CommandResponse } from '@connpass-discord-bot/core';
import { executeCommand } from '../adapter/cli-adapter.js';

type AppState =
  | 'loading'
  | 'main-menu'
  | 'server-select'
  | 'channel-select'
  | 'command'
  | 'config-view'
  | 'log-view'
  | 'error';

// インメモリログライター（シングルトン）
const inMemoryLogWriter = new InMemoryLogWriter(500);

// ロガーにインメモリライターを追加
const logger = Logger.getInstance();
logger.addWriter(inMemoryLogWriter);

export function App(): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();

  // 基本状態
  const [state, setState] = useState<AppState>('loading');
  const [client, setClient] = useState<Client | null>(null);
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<Guild | null>(null);
  const [channels, setChannels] = useState<TextChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<TextChannel | null>(null);
  const [error, setError] = useState<string | null>(null);

  // セッションログ
  const [sessionLogs, setSessionLogs] = useState<SessionLogEntry[]>([]);
  const [scrollOffset, setScrollOffset] = useState(0);

  // ターミナル高さに基づいた表示行数
  const maxVisibleLogs = useMemo(() => {
    const terminalRows = stdout?.rows || 24;
    // ヘッダー(3行) + ステータスバー(3行) + 入力欄(5行) + サジェスト(8行) + マージン(3行) = 22行
    return Math.max(3, terminalRows - 22);
  }, [stdout?.rows]);

  // スクロール状態
  const canScrollUp = sessionLogs.length > maxVisibleLogs && scrollOffset < sessionLogs.length - maxVisibleLogs;
  const canScrollDown = scrollOffset > 0;

  // キー入力ハンドリング
  useInput((input, key) => {
    // Ctrl+C でアプリ終了
    if (key.ctrl && input === 'c') {
      if (client) {
        client.destroy();
      }
      exit();
      return;
    }

    // Escで前の画面に戻る
    if (key.escape) {
      if (state === 'channel-select') {
        setState('server-select');
      } else if (state === 'command') {
        setState('channel-select');
        // ログはリセットしない（セッション継続）
      } else if (state === 'server-select') {
        setState('main-menu');
      } else if (state === 'config-view' || state === 'log-view') {
        setState('main-menu');
      }
      return;
    }

    // スクロール（Shift + 上下キー）
    if (state === 'command' && key.shift) {
      if (key.upArrow && canScrollUp) {
        setScrollOffset((prev) => Math.min(prev + 1, sessionLogs.length - maxVisibleLogs));
      } else if (key.downArrow && canScrollDown) {
        setScrollOffset((prev) => Math.max(prev - 1, 0));
      }
    }
  });

  // Discord クライアント初期化
  useEffect(() => {
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) {
      // トークンがなくてもメニューは表示可能（Discordの設定だけ使えない）
      setState('main-menu');
      return;
    }

    const discordClient = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    discordClient.once('ready', () => {
      const guildList = Array.from(discordClient.guilds.cache.values());
      setGuilds(guildList);
      setClient(discordClient);
      setState('main-menu');
    });

    discordClient.on('error', (err) => {
      setError(`Discord接続エラー: ${err.message}`);
      // エラーでもメニューは表示
      setState('main-menu');
    });

    discordClient.login(token).catch((err) => {
      setError(`ログイン失敗: ${err.message}`);
      // エラーでもメニューは表示
      setState('main-menu');
    });

    return () => {
      discordClient.destroy();
    };
  }, []);

  // メインメニュー選択
  const handleMenuSelect = useCallback((option: MenuOption) => {
    switch (option) {
      case 'discord':
        if (!client) {
          setError('DISCORD_BOT_TOKEN が設定されていません');
          setState('error');
        } else {
          setState('server-select');
        }
        break;
      case 'config':
        setState('config-view');
        break;
      case 'logs':
        setState('log-view');
        break;
    }
  }, [client]);

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
    // 新しいチャンネル選択時にログをクリア
    setSessionLogs([]);
    setScrollOffset(0);
    // 開始メッセージを追加
    setSessionLogs([
      createLogEntry('info', `チャンネル #${channel.name} に接続しました`),
    ]);
    setState('command');
  }, []);

  // コマンド実行
  const handleExecuteCommand = useCallback(
    async (command: string): Promise<CommandResponse> => {
      if (!selectedChannel) {
        return { content: 'チャンネルが選択されていません', ephemeral: true };
      }

      // コマンドをログに追加
      setSessionLogs((prev) => [...prev, createLogEntry('command', command)]);
      // スクロールをリセット（最新を表示）
      setScrollOffset(0);

      try {
        const result = await executeCommand(command, selectedChannel.id);

        // 結果をログに追加
        setSessionLogs((prev) => [
          ...prev,
          createLogEntry(result.ephemeral ? 'error' : 'result', result.content),
        ]);

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        // エラーをログに追加
        setSessionLogs((prev) => [
          ...prev,
          createLogEntry('error', `エラー: ${errorMessage}`),
        ]);

        return { content: errorMessage, ephemeral: true };
      }
    },
    [selectedChannel]
  );

  // ステータスバーのヒント
  const statusHints = useMemo(
    () =>
      getStatusHints(state, {
        hasLogs: sessionLogs.length > 0,
        canScrollUp,
        canScrollDown,
      }),
    [state, sessionLogs.length, canScrollUp, canScrollDown]
  );

  return (
    <Box flexDirection="column" padding={1}>
      {/* メインメニュー以外ではヘッダー表示 */}
      {state !== 'main-menu' && state !== 'config-view' && state !== 'log-view' && (
        <Header
          serverName={selectedGuild?.name}
          channelName={selectedChannel?.name}
        />
      )}

      {/* メインコンテンツ */}
      {state === 'loading' && (
        <Box>
          <Text color="green">
            <Spinner type="dots" />
          </Text>
          <Text> Discord に接続中...</Text>
        </Box>
      )}

      {state === 'main-menu' && (
        <Box flexDirection="column">
          {error && (
            <Box marginBottom={1}>
              <Text color="yellow">⚠️ {error}</Text>
            </Box>
          )}
          <MainMenu onSelect={handleMenuSelect} />
        </Box>
      )}

      {state === 'error' && (
        <Box flexDirection="column">
          <Text color="red">エラー: {error}</Text>
          <Box marginTop={1}>
            <Text color="gray">Esc: メニューに戻る</Text>
          </Box>
        </Box>
      )}

      {state === 'config-view' && (
        <ConfigViewer />
      )}

      {state === 'log-view' && (
        <SystemLogViewer logWriter={inMemoryLogWriter} />
      )}

      {state === 'server-select' && (
        <ServerSelect guilds={guilds} onSelect={handleServerSelect} />
      )}

      {state === 'channel-select' && (
        <ChannelSelect channels={channels} onSelect={handleChannelSelect} />
      )}

      {state === 'command' && selectedChannel && (
        <Box flexDirection="column">
          {/* セッションログ */}
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
            paddingY={0}
            marginBottom={1}
          >
            <Text color="gray" dimColor>ログ (Shift+↑↓: スクロール)</Text>
            <SessionLogView
              logs={sessionLogs}
              maxVisible={maxVisibleLogs}
              scrollOffset={scrollOffset}
            />
          </Box>

          {/* コマンド入力 */}
          <CommandInputWithSuggestions
            channelId={selectedChannel.id}
            onExecute={handleExecuteCommand}
          />
        </Box>
      )}

      {/* ステータスバー（メインメニュー以外で表示） */}
      {state !== 'main-menu' && state !== 'config-view' && state !== 'log-view' && (
        <StatusBar hints={statusHints} />
      )}
    </Box>
  );
}
