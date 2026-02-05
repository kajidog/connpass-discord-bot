import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryLogWriter } from './InMemoryLogWriter.js';
import { LogLevel, ActionType } from './types.js';
import type { LogEntry, ActionLogEntry } from './types.js';

function createLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: new Date(),
    level: LogLevel.INFO,
    component: 'TestComponent',
    message: 'Test message',
    ...overrides,
  };
}

function createActionLogEntry(overrides: Partial<ActionLogEntry> = {}): ActionLogEntry {
  return {
    timestamp: new Date(),
    level: LogLevel.INFO,
    component: 'TestComponent',
    message: 'Test action',
    actionType: ActionType.GENERAL,
    ...overrides,
  };
}

describe('InMemoryLogWriter', () => {
  let writer: InMemoryLogWriter;

  beforeEach(() => {
    writer = new InMemoryLogWriter();
  });

  describe('write', () => {
    it('ログエントリを保存する', () => {
      writer.write(createLogEntry());

      const logs = writer.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test message');
      expect(logs[0].id).toBeDefined();
    });

    it('複数のログエントリを保存する', () => {
      writer.write(createLogEntry({ message: 'First' }));
      writer.write(createLogEntry({ message: 'Second' }));
      writer.write(createLogEntry({ message: 'Third' }));

      expect(writer.getLogs()).toHaveLength(3);
    });
  });

  describe('writeAction', () => {
    it('アクションログエントリを保存する', () => {
      writer.writeAction(createActionLogEntry());

      const actionLogs = writer.getActionLogs();
      expect(actionLogs).toHaveLength(1);
      expect(actionLogs[0].actionType).toBe(ActionType.GENERAL);
    });
  });

  describe('maxSize', () => {
    it('最大サイズを超えたら古いログを削除する', () => {
      const smallWriter = new InMemoryLogWriter(3);

      smallWriter.write(createLogEntry({ message: 'msg-1' }));
      smallWriter.write(createLogEntry({ message: 'msg-2' }));
      smallWriter.write(createLogEntry({ message: 'msg-3' }));
      smallWriter.write(createLogEntry({ message: 'msg-4' }));

      const logs = smallWriter.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('msg-2');
      expect(logs[2].message).toBe('msg-4');
    });

    it('アクションログも最大サイズで制限される', () => {
      const smallWriter = new InMemoryLogWriter(2);

      smallWriter.writeAction(createActionLogEntry({ message: 'a1' }));
      smallWriter.writeAction(createActionLogEntry({ message: 'a2' }));
      smallWriter.writeAction(createActionLogEntry({ message: 'a3' }));

      const actionLogs = smallWriter.getActionLogs();
      expect(actionLogs).toHaveLength(2);
      expect(actionLogs[0].message).toBe('a2');
    });
  });

  describe('getLogs - フィルタリング', () => {
    beforeEach(() => {
      writer.write(createLogEntry({ level: LogLevel.DEBUG, component: 'CompA', message: 'debug msg' }));
      writer.write(createLogEntry({ level: LogLevel.INFO, component: 'CompB', message: 'info msg' }));
      writer.write(createLogEntry({ level: LogLevel.WARN, component: 'CompA', message: 'warn msg' }));
      writer.write(createLogEntry({ level: LogLevel.ERROR, component: 'CompC', message: 'error msg' }));
    });

    it('レベルでフィルタリングする', () => {
      const logs = writer.getLogs({ level: LogLevel.WARN });
      expect(logs).toHaveLength(2); // WARN + ERROR
    });

    it('コンポーネント名でフィルタリングする', () => {
      const logs = writer.getLogs({ component: 'CompA' });
      expect(logs).toHaveLength(2);
    });

    it('コンポーネント名は大文字小文字を無視する', () => {
      const logs = writer.getLogs({ component: 'compa' });
      expect(logs).toHaveLength(2);
    });

    it('キーワードでフィルタリングする', () => {
      const logs = writer.getLogs({ keyword: 'warn' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('warn msg');
    });

    it('limit で件数を制限する', () => {
      const logs = writer.getLogs({ limit: 2 });
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe(LogLevel.WARN);
      expect(logs[1].level).toBe(LogLevel.ERROR);
    });

    it('複数のフィルタを組み合わせる', () => {
      const logs = writer.getLogs({ level: LogLevel.INFO, component: 'CompA' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('warn msg');
    });
  });

  describe('getAllLogs', () => {
    it('通常ログとアクションログを時系列で結合する', () => {
      const t1 = new Date('2024-01-01T00:00:00Z');
      const t2 = new Date('2024-01-01T00:01:00Z');
      const t3 = new Date('2024-01-01T00:02:00Z');

      writer.writeAction(createActionLogEntry({ timestamp: t2, message: 'action' }));
      writer.write(createLogEntry({ timestamp: t1, message: 'log-first' }));
      writer.write(createLogEntry({ timestamp: t3, message: 'log-last' }));

      const all = writer.getAllLogs();
      expect(all).toHaveLength(3);
      expect(all[0].message).toBe('log-first');
      expect(all[1].message).toBe('action');
      expect(all[2].message).toBe('log-last');
    });
  });

  describe('clear', () => {
    it('全ログをクリアする', () => {
      writer.write(createLogEntry());
      writer.writeAction(createActionLogEntry());

      writer.clear();

      expect(writer.getLogs()).toHaveLength(0);
      expect(writer.getActionLogs()).toHaveLength(0);
    });
  });

  describe('getCount', () => {
    it('ログ件数を正しく返す', () => {
      writer.write(createLogEntry());
      writer.write(createLogEntry());
      writer.writeAction(createActionLogEntry());

      const count = writer.getCount();
      expect(count.logs).toBe(2);
      expect(count.actionLogs).toBe(1);
      expect(count.total).toBe(3);
    });
  });

  describe('addListener', () => {
    it('ログ追加時にリスナーが呼ばれる', () => {
      const listener = vi.fn();
      writer.addListener(listener);

      writer.write(createLogEntry());

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('アクションログ追加時にもリスナーが呼ばれる', () => {
      const listener = vi.fn();
      writer.addListener(listener);

      writer.writeAction(createActionLogEntry());

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('リスナーの解除ができる', () => {
      const listener = vi.fn();
      const unsubscribe = writer.addListener(listener);

      writer.write(createLogEntry());
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      writer.write(createLogEntry());
      expect(listener).toHaveBeenCalledTimes(1); // 増えない
    });

    it('リスナーのエラーは無視される', () => {
      const badListener = vi.fn().mockImplementation(() => {
        throw new Error('listener error');
      });
      const goodListener = vi.fn();

      writer.addListener(badListener);
      writer.addListener(goodListener);

      writer.write(createLogEntry());

      expect(badListener).toHaveBeenCalledTimes(1);
      expect(goodListener).toHaveBeenCalledTimes(1);
    });
  });
});
