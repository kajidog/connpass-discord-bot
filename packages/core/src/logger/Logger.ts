import {
  LogLevel,
  LogEntry,
  ActionLogEntry,
  ILogger,
  ILogWriter,
  logLevelToString,
} from './types.js';

/**
 * コンソールログライター
 */
export class ConsoleLogWriter implements ILogWriter {
  write(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = logLevelToString(entry.level);
    const prefix = `[${timestamp}] [${level}] [${entry.component}]`;

    let logFn: (...args: unknown[]) => void;
    switch (entry.level) {
      case LogLevel.DEBUG:
        logFn = console.debug;
        break;
      case LogLevel.INFO:
        logFn = console.log;
        break;
      case LogLevel.WARN:
        logFn = console.warn;
        break;
      case LogLevel.ERROR:
        logFn = console.error;
        break;
      default:
        logFn = console.log;
    }

    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      logFn(prefix, entry.message, entry.metadata);
    } else {
      logFn(prefix, entry.message);
    }
  }

  writeAction(entry: ActionLogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = logLevelToString(entry.level);
    const prefix = `[${timestamp}] [${level}] [${entry.component}] [ACTION:${entry.actionType}]`;

    const details: Record<string, unknown> = {};
    if (entry.userId) details.userId = entry.userId;
    if (entry.guildId) details.guildId = entry.guildId;
    if (entry.channelId) details.channelId = entry.channelId;
    if (entry.beforeState) details.before = entry.beforeState;
    if (entry.afterState) details.after = entry.afterState;
    if (entry.metadata) Object.assign(details, entry.metadata);

    if (Object.keys(details).length > 0) {
      console.log(prefix, entry.message, details);
    } else {
      console.log(prefix, entry.message);
    }
  }
}

/**
 * メインロガークラス
 */
export class Logger implements ILogger {
  private level: LogLevel;
  private writers: ILogWriter[] = [];
  private static instance: Logger | null = null;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  /**
   * シングルトンインスタンスを取得
   * インスタンスが未作成の場合、デフォルト設定（コンソール出力）で自動作成される
   * これにより initialize() 前でも安全にログ出力が可能
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
      // デフォルトでコンソール出力を有効化（初期化前でもログが出るように）
      Logger.instance.addWriter(new ConsoleLogWriter());
    }
    return Logger.instance;
  }

  /**
   * シングルトンインスタンスを初期化（アプリケーション起動時に呼び出す）
   * 注意: writersはクリアされるので、呼び出し側で明示的に追加する
   */
  static initialize(level: LogLevel = LogLevel.INFO): Logger {
    Logger.instance = new Logger(level);
    return Logger.instance;
  }

  /**
   * ログライターを追加
   */
  addWriter(writer: ILogWriter): void {
    this.writers.push(writer);
  }

  /**
   * ログレベルを設定
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 現在のログレベルを取得
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * 指定レベルでログを出力すべきかチェック
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  /**
   * ログエントリを書き込む
   */
  private writeLog(entry: LogEntry): void {
    for (const writer of this.writers) {
      try {
        writer.write(entry);
      } catch (e) {
        // ライターエラーは無視（無限ループ防止）
        console.error('[Logger] Writer error:', e);
      }
    }
  }

  /**
   * アクションログエントリを書き込む
   */
  private writeActionLog(entry: ActionLogEntry): void {
    for (const writer of this.writers) {
      try {
        writer.writeAction(entry);
      } catch (e) {
        console.error('[Logger] Writer error:', e);
      }
    }
  }

  debug(component: string, message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;
    this.writeLog({
      timestamp: new Date(),
      level: LogLevel.DEBUG,
      component,
      message,
      metadata,
    });
  }

  info(component: string, message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;
    this.writeLog({
      timestamp: new Date(),
      level: LogLevel.INFO,
      component,
      message,
      metadata,
    });
  }

  warn(component: string, message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;
    this.writeLog({
      timestamp: new Date(),
      level: LogLevel.WARN,
      component,
      message,
      metadata,
    });
  }

  error(component: string, message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;
    this.writeLog({
      timestamp: new Date(),
      level: LogLevel.ERROR,
      component,
      message,
      metadata,
    });
  }

  logAction(entry: Omit<ActionLogEntry, 'timestamp'>): void {
    if (!this.shouldLog(entry.level)) return;
    this.writeActionLog({
      ...entry,
      timestamp: new Date(),
    });
  }
}

/**
 * 特定コンポーネント用のロガーを作成するヘルパー
 */
export function createComponentLogger(component: string, logger?: ILogger) {
  const log = logger ?? Logger.getInstance();
  return {
    debug: (message: string, metadata?: Record<string, unknown>) =>
      log.debug(component, message, metadata),
    info: (message: string, metadata?: Record<string, unknown>) =>
      log.info(component, message, metadata),
    warn: (message: string, metadata?: Record<string, unknown>) =>
      log.warn(component, message, metadata),
    error: (message: string, metadata?: Record<string, unknown>) =>
      log.error(component, message, metadata),
    logAction: (entry: Omit<ActionLogEntry, 'timestamp' | 'component'>) =>
      log.logAction({ ...entry, component }),
  };
}
