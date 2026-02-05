import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Logger, ConsoleLogWriter, createComponentLogger } from './Logger.js';
import { LogLevel, ActionType } from './types.js';
import type { ILogWriter, LogEntry, ActionLogEntry } from './types.js';

describe('Logger', () => {
  let logger: Logger;
  let mockWriter: ILogWriter;

  beforeEach(() => {
    logger = new Logger(LogLevel.DEBUG);
    mockWriter = {
      write: vi.fn(),
      writeAction: vi.fn(),
    };
    logger.addWriter(mockWriter);
  });

  describe('ログレベルによるフィルタリング', () => {
    it('設定レベル以上のログのみ出力する', () => {
      logger.setLevel(LogLevel.WARN);

      logger.debug('comp', 'debug msg');
      logger.info('comp', 'info msg');
      logger.warn('comp', 'warn msg');
      logger.error('comp', 'error msg');

      expect(mockWriter.write).toHaveBeenCalledTimes(2);
    });

    it('DEBUG レベルでは全てのログを出力する', () => {
      logger.setLevel(LogLevel.DEBUG);

      logger.debug('comp', 'debug');
      logger.info('comp', 'info');
      logger.warn('comp', 'warn');
      logger.error('comp', 'error');

      expect(mockWriter.write).toHaveBeenCalledTimes(4);
    });

    it('ERROR レベルではエラーのみ出力する', () => {
      logger.setLevel(LogLevel.ERROR);

      logger.debug('comp', 'debug');
      logger.info('comp', 'info');
      logger.warn('comp', 'warn');
      logger.error('comp', 'error');

      expect(mockWriter.write).toHaveBeenCalledTimes(1);
    });
  });

  describe('ログエントリの構造', () => {
    it('正しい構造のエントリをライターに渡す', () => {
      logger.info('MyComponent', 'Hello world', { key: 'value' });

      expect(mockWriter.write).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          component: 'MyComponent',
          message: 'Hello world',
          metadata: { key: 'value' },
          timestamp: expect.any(Date),
        })
      );
    });

    it('metadata なしでも動作する', () => {
      logger.info('comp', 'no metadata');

      expect(mockWriter.write).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: undefined,
        })
      );
    });
  });

  describe('logAction', () => {
    it('アクションログエントリをライターに渡す', () => {
      logger.logAction({
        level: LogLevel.INFO,
        component: 'Scheduler',
        message: 'Feed executed',
        actionType: ActionType.SCHEDULER_EXECUTE,
        userId: 'user-1',
        channelId: 'ch-1',
      });

      expect(mockWriter.writeAction).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          component: 'Scheduler',
          message: 'Feed executed',
          actionType: ActionType.SCHEDULER_EXECUTE,
          userId: 'user-1',
          channelId: 'ch-1',
          timestamp: expect.any(Date),
        })
      );
    });

    it('ログレベルでフィルタリングされる', () => {
      logger.setLevel(LogLevel.ERROR);

      logger.logAction({
        level: LogLevel.INFO,
        component: 'comp',
        message: 'action',
        actionType: ActionType.GENERAL,
      });

      expect(mockWriter.writeAction).not.toHaveBeenCalled();
    });
  });

  describe('複数ライター', () => {
    it('全てのライターにログが送信される', () => {
      const writer2: ILogWriter = {
        write: vi.fn(),
        writeAction: vi.fn(),
      };
      logger.addWriter(writer2);

      logger.info('comp', 'msg');

      expect(mockWriter.write).toHaveBeenCalledTimes(1);
      expect(writer2.write).toHaveBeenCalledTimes(1);
    });

    it('一つのライターがエラーを投げても他のライターは動作する', () => {
      const errorWriter: ILogWriter = {
        write: vi.fn().mockImplementation(() => {
          throw new Error('writer failed');
        }),
        writeAction: vi.fn(),
      };
      const goodWriter: ILogWriter = {
        write: vi.fn(),
        writeAction: vi.fn(),
      };

      // console.errorを抑制
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const freshLogger = new Logger(LogLevel.DEBUG);
      freshLogger.addWriter(errorWriter);
      freshLogger.addWriter(goodWriter);

      freshLogger.info('comp', 'msg');

      expect(goodWriter.write).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });
  });

  describe('setLevel / getLevel', () => {
    it('レベルの設定と取得が動作する', () => {
      logger.setLevel(LogLevel.WARN);
      expect(logger.getLevel()).toBe(LogLevel.WARN);

      logger.setLevel(LogLevel.DEBUG);
      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });
  });

  describe('clearWriters', () => {
    it('全てのライターを削除する', () => {
      logger.clearWriters();
      logger.info('comp', 'msg');

      expect(mockWriter.write).not.toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('シングルトンを再初期化してライターをクリアする', () => {
      const instance = Logger.initialize(LogLevel.WARN);

      expect(instance.getLevel()).toBe(LogLevel.WARN);
      // ライターがクリアされているので追加してテスト
      const writer: ILogWriter = { write: vi.fn(), writeAction: vi.fn() };
      instance.addWriter(writer);
      // INFO は WARN レベル以下なので出力されない
      instance.info('comp', 'msg');
      expect(writer.write).toHaveBeenCalledTimes(0);
      // WARN は出力される
      instance.warn('comp', 'msg');
      expect(writer.write).toHaveBeenCalledTimes(1);
    });
  });
});

describe('createComponentLogger', () => {
  it('コンポーネント名が自動的に付与される', () => {
    const mockWriter: ILogWriter = { write: vi.fn(), writeAction: vi.fn() };
    const baseLogger = new Logger(LogLevel.DEBUG);
    baseLogger.addWriter(mockWriter);

    const componentLog = createComponentLogger('MyService', baseLogger);

    componentLog.info('hello');
    componentLog.warn('warning');

    expect(mockWriter.write).toHaveBeenCalledTimes(2);
    expect(mockWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'MyService', message: 'hello' })
    );
    expect(mockWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'MyService', message: 'warning' })
    );
  });

  it('logAction にもコンポーネント名が付与される', () => {
    const mockWriter: ILogWriter = { write: vi.fn(), writeAction: vi.fn() };
    const baseLogger = new Logger(LogLevel.DEBUG);
    baseLogger.addWriter(mockWriter);

    const componentLog = createComponentLogger('Scheduler', baseLogger);

    componentLog.logAction({
      level: LogLevel.INFO,
      message: 'executed',
      actionType: ActionType.SCHEDULER_EXECUTE,
    });

    expect(mockWriter.writeAction).toHaveBeenCalledWith(
      expect.objectContaining({ component: 'Scheduler' })
    );
  });
});
