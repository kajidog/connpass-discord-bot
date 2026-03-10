import { Message, EmbedBuilder, TextChannel, ThreadChannel, DMChannel, NewsChannel } from 'discord.js';

type SendableChannel = TextChannel | ThreadChannel | DMChannel | NewsChannel;

/**
 * ツール名の日本語表示マッピング
 */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  searchEvents: 'イベント検索',
  getEventDetails: 'イベント詳細取得',
  getUserSchedule: 'スケジュール取得',
  manageFeed: 'フィード管理',
  manageNotify: '通知管理',
  getConversationSummary: '会話要約',
  getMessage: 'メッセージ取得',
};

interface ProgressLine {
  id: string;
  toolName?: string; // メッセージ再構築用にツール名を保持
  icon: string;
  text: string;
  timestamp: Date;
}

/**
 * Discord進捗メッセージ管理クラス
 * ツール実行状況をリアルタイムでEmbedに表示・更新
 */
type ProgressState = 'thinking' | 'executing' | 'completed' | 'error';

export class ProgressEmbed {
  private message: Message | null = null;
  private lines: ProgressLine[] = [];
  private toolStartTimes: Map<string, number> = new Map();
  private toolArgs: Map<string, string> = new Map();
  private processStartTime: number = 0;
  private modelInfo: { provider: string; model: string } | null = null;
  
  private channel: SendableChannel;
  private updateTimer: NodeJS.Timeout | null = null;
  private pendingUpdate = false;
  private isCompleted = false;
  private state: ProgressState = 'thinking';

  // Discord APIレート制限対策: 最小更新間隔 (ms)
  private readonly UPDATE_INTERVAL = 1000;

  constructor(channel: SendableChannel) {
    this.channel = channel;
  }

  /**
   * 使用モデル情報を設定
   */
  setModelInfo(provider: string, model: string): void {
    this.modelInfo = { provider, model };
    this.scheduleUpdate();
  }

  /**
   * 進捗メッセージを初期化して送信
   */
  async start(userQuery: string): Promise<void> {
    this.processStartTime = Date.now();
    this.setThinking(true);
    const embed = this.buildEmbed(userQuery);
    this.message = await this.channel.send({ embeds: [embed] });
  }

  /**
   * 思考中ステータスの切り替え
   */
  private setThinking(enabled: boolean): void {
    if (enabled) {
      // 既に存在しなければ追加
      if (!this.lines.find(l => l.id === 'thinking')) {
        this.addStatus('🤔', '思考中...', 'thinking');
      }
      this.state = 'thinking';
    } else {
      this.removeLine('thinking');
    }
  }

  /**
   * ツール呼び出し開始を追加
   * @returns 呼び出しID (完了報告に使用)
   */
  addToolCall(toolName: string, args?: Record<string, unknown>): string {
    this.setThinking(false);
    this.state = 'executing';
    
    // ユニークIDを生成
    const callId = `${toolName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    this.toolStartTimes.set(callId, Date.now());
    const displayName = TOOL_DISPLAY_NAMES[toolName] || toolName;
    let text = `**${displayName}**`;

    console.log(`[Agent] Tool Start: ${toolName} (ID: ${callId})`);
    if (args) {
      console.log(`[Agent] Tool Args:`, JSON.stringify(args));
    }

    // 引数の簡易表示
    if (args) {
      const argSummary = this.formatArgs(args);
      if (argSummary) {
        text += ` [${argSummary}]`;
        this.toolArgs.set(callId, `[${argSummary}]`);
      }
    }

    // 新規行として追加
    this.lines.push({
      id: callId,
      toolName,
      icon: '▶️',
      text,
      timestamp: new Date(),
    });
    this.scheduleUpdate();
    
    return callId;
  }

  /**
   * ツール完了を追加
   * @param callId addToolCallが返したID
   */
  addToolResult(callId: string, success: boolean, summary?: string): void {
    const startTime = this.toolStartTimes.get(callId);
    const duration = startTime ? Date.now() - startTime : 0;
    const timeStr = this.formatDuration(duration);

    // 行を検索
    const existingIndex = this.lines.findIndex(l => l.id === callId);
    if (existingIndex === -1) {
      console.warn(`[Progress] Tool result received for unknown ID: ${callId}`);
      return;
    }

    const line = this.lines[existingIndex];
    const toolName = line.toolName || 'Unknown Tool';
    const displayName = TOOL_DISPLAY_NAMES[toolName] || toolName;

    console.log(`[Agent] Tool End: ${toolName} (ID: ${callId}) - Success: ${success}, Duration: ${timeStr}`);
    if (summary) console.log(`[Agent] Tool Result Summary: ${summary}`);

    const icon = success ? '✅' : '⚠️';
    let text = `**${displayName}**`;

    // 引数を復元
    const cachedArgs = this.toolArgs.get(callId);
    if (cachedArgs) {
      text += ` ${cachedArgs}`;
    }

    if (summary) {
      text += ` => ${summary}`;
    }
    
    text += ` (${timeStr})`;

    // 更新
    this.lines[existingIndex] = {
      ...line,
      icon,
      text,
      timestamp: new Date(),
    };
    
    // ツール完了後は思考中に戻る
    this.setThinking(true);
    this.scheduleUpdate();
  }

  /**
   * ツールエラー（バリデーションエラーなど）を追加
   * @param toolName ツール名
   * @param errorMessage エラーメッセージ
   */
  addToolError(toolName: string, errorMessage: string): void {
    const displayName = TOOL_DISPLAY_NAMES[toolName] || toolName;
    const errorId = `error-${toolName}-${Date.now()}`;
    this.lines.push({
      id: errorId,
      toolName,
      icon: '❌',
      text: `**${displayName}** エラー: ${errorMessage.slice(0, 100)}`,
      timestamp: new Date(),
    });
    // エラー後は思考中に戻る
    this.setThinking(true);
    this.scheduleUpdate();
  }

  /**
   * カスタムステータス行を追加
   */
  addStatus(icon: string, text: string, id?: string): void {
    const lineId = id || `status-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.lines.push({
      id: lineId,
      icon,
      text,
      timestamp: new Date(),
    });
    this.scheduleUpdate();
  }

  /**
   * 指定IDの行を削除
   */
  private removeLine(id: string): void {
    const initialLength = this.lines.length;
    this.lines = this.lines.filter(l => l.id !== id);
    if (this.lines.length !== initialLength) {
      this.scheduleUpdate();
    }
  }

  /**
   * 処理完了としてマーク
   */
  async complete(): Promise<void> {
    if (this.isCompleted) return;
    
    this.setThinking(false);
    this.state = 'completed';
    
    const totalDuration = Date.now() - this.initTimestamp();
    this.lines.push({
      id: 'complete',
      icon: '✅',
      text: `処理完了 (${this.formatDuration(totalDuration)})`,
      timestamp: new Date(),
    });

    this.isCompleted = true;

    // 最終更新を即座に実行
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    await this.doUpdate();
  }

  /**
   * エラー時の表示
   */
  async error(errorMessage: string): Promise<void> {
    this.setThinking(false);
    this.state = 'error';
    const totalDuration = Date.now() - this.initTimestamp();
    this.lines.push({
      id: 'error',
      icon: '❌',
      text: `エラー: ${errorMessage} (${this.formatDuration(totalDuration)})`,
      timestamp: new Date(),
    });
    this.isCompleted = true;

    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }

    await this.doUpdate();
  }

  /**
   * 引数を読みやすい形式にフォーマット
   */
  private formatArgs(args: Record<string, unknown>): string {
    const parts: string[] = [];

    if (args.keyword && typeof args.keyword === 'string') {
      parts.push(`"${args.keyword}"`);
    }
    if (args.prefecture && typeof args.prefecture === 'string') {
      parts.push(args.prefecture);
    }
    if (args.eventId) {
      parts.push(`ID: ${args.eventId}`);
    }
    if (args.action && typeof args.action === 'string') {
      parts.push(args.action);
    }
    
    // 日付範囲
    if (args.daysAhead) {
      parts.push(`${args.daysAhead}日分`);
    }

    return parts.slice(0, 3).join(', ');
  }

  /**
   * 経過時間のフォーマット
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }
  
  private initTimestamp(): number {
    return this.processStartTime || Date.now();
  }

  /**
   * Embedを構築
   */
  private buildEmbed(userQuery?: string): EmbedBuilder {
    // ステータスに応じた色設定
    let color = 0x2B2D31; // Default/Dark
    switch (this.state) {
      case 'thinking':
        color = 0x5865F2; // Blurple (Thinking)
        break;
      case 'executing':
        color = 0xF1C40F; // Yellow/Orange (Running Tool)
        break;
      case 'completed':
        color = 0x00AA00; // Green (Success)
        break;
      case 'error':
        color = 0xED4245; // Red (Error)
        break;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🤖 システムログ'); // Static title

    // クエリ表示
    if (userQuery) {
      embed.setDescription(`\`\`\`\n${userQuery.slice(0, 100)}${userQuery.length > 100 ? '...' : ''}\n\`\`\``);
    }

    // モデル情報を表示
    if (this.modelInfo) {
      embed.addFields({
        name: 'MODEL',
        value: `\`${this.modelInfo.provider}/${this.modelInfo.model}\``,
        inline: true,
      });
    }

    // 進捗ライン
    if (this.lines.length > 0) {
      const progressText = this.lines
        .map(line => `${line.icon} ${line.text}`)
        .join('\n');

      embed.addFields({
        name: 'STATUS',
        value: progressText.slice(0, 1024),
      });
    }

    // タイムスタンプ
    embed.setTimestamp();

    return embed;
  }

  /**
   * 更新をスケジュール（レート制限対策）
   */
  private scheduleUpdate(): void {
    if (this.isCompleted) return;

    this.pendingUpdate = true;

    if (!this.updateTimer) {
      this.updateTimer = setTimeout(async () => {
        this.updateTimer = null;
        if (this.pendingUpdate) {
          this.pendingUpdate = false;
          await this.doUpdate();
        }
      }, this.UPDATE_INTERVAL);
    }
  }

  /**
   * 実際のメッセージ更新
   */
  private async doUpdate(): Promise<void> {
    if (!this.message) return;

    try {
      const embed = this.buildEmbed();
      await this.message.edit({ embeds: [embed] });
    } catch (e) {
      console.warn('[ProgressEmbed] Failed to update message:', e);
    }
  }
}
