/**
 * ログレベル
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * ログ出力先
 */
export enum LogDestination {
  CONSOLE = 'console',
  DATABASE = 'database',
  BOTH = 'both',
}

/**
 * ログエントリの基本構造
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * アクションタイプ（特定の操作を追跡するため）
 */
export enum ActionType {
  // AI関連
  AI_AGENT_START = 'ai_agent_start',
  AI_AGENT_END = 'ai_agent_end',
  AI_TOOL_CALL = 'ai_tool_call',
  AI_MODEL_CHANGE = 'ai_model_change',
  AI_ERROR = 'ai_error',

  // スケジュール関連
  SCHEDULE_CREATE = 'schedule_create',
  SCHEDULE_UPDATE = 'schedule_update',
  SCHEDULE_DELETE = 'schedule_delete',

  // スケジューラー関連
  SCHEDULER_START = 'scheduler_start',
  SCHEDULER_STOP = 'scheduler_stop',
  SCHEDULER_EXECUTE = 'scheduler_execute',
  SCHEDULER_ERROR = 'scheduler_error',

  // 通知関連
  NOTIFY_SEND = 'notify_send',
  NOTIFY_ERROR = 'notify_error',

  // 一般
  GENERAL = 'general',
}

/**
 * アクションログエントリ（ユーザー操作や重要なイベントを追跡）
 */
export interface ActionLogEntry extends LogEntry {
  actionType: ActionType;
  userId?: string;
  guildId?: string;
  channelId?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

/**
 * ログ設定
 */
export interface LogConfig {
  level: LogLevel;
  destination: LogDestination;
  enableActionLog?: boolean;
}

/**
 * ログライター（出力先への書き込みインターフェース）
 */
export interface ILogWriter {
  write(entry: LogEntry): void | Promise<void>;
  writeAction(entry: ActionLogEntry): void | Promise<void>;
}

/**
 * ロガーインターフェース
 */
export interface ILogger {
  debug(component: string, message: string, metadata?: Record<string, unknown>): void;
  info(component: string, message: string, metadata?: Record<string, unknown>): void;
  warn(component: string, message: string, metadata?: Record<string, unknown>): void;
  error(component: string, message: string, metadata?: Record<string, unknown>): void;

  // アクションログ
  logAction(entry: Omit<ActionLogEntry, 'timestamp'>): void;

  // 設定変更
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;

  // ライター管理
  addWriter(writer: ILogWriter): void;
}

/**
 * 文字列からログレベルへの変換
 */
export function parseLogLevel(level: string): LogLevel {
  switch (level.toLowerCase()) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
    case 'warning':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}

/**
 * ログレベルを文字列に変換
 */
export function logLevelToString(level: LogLevel): string {
  switch (level) {
    case LogLevel.DEBUG:
      return 'DEBUG';
    case LogLevel.INFO:
      return 'INFO';
    case LogLevel.WARN:
      return 'WARN';
    case LogLevel.ERROR:
      return 'ERROR';
    default:
      return 'UNKNOWN';
  }
}

/**
 * 文字列からログ出力先への変換
 */
export function parseLogDestination(destination: string): LogDestination {
  switch (destination.toLowerCase()) {
    case 'console':
      return LogDestination.CONSOLE;
    case 'database':
    case 'db':
      return LogDestination.DATABASE;
    case 'both':
      return LogDestination.BOTH;
    default:
      return LogDestination.CONSOLE;
  }
}
