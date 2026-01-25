/**
 * インメモリログライター
 * ログをメモリに保持し、CLIなどで表示するために使用
 */

import type { LogEntry, ActionLogEntry, ILogWriter } from './types.js';

export interface InMemoryLogEntry extends LogEntry {
  id: string;
}

export interface InMemoryActionLogEntry extends ActionLogEntry {
  id: string;
}

export interface LogFilterOptions {
  level?: number;
  component?: string;
  keyword?: string;
  limit?: number;
}

/**
 * ログをメモリに保持するログライター
 */
export class InMemoryLogWriter implements ILogWriter {
  private logs: InMemoryLogEntry[] = [];
  private actionLogs: InMemoryActionLogEntry[] = [];
  private maxSize: number;
  private idCounter = 0;
  private listeners: Set<() => void> = new Set();

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  private generateId(): string {
    return `${Date.now()}-${++this.idCounter}`;
  }

  write(entry: LogEntry): void {
    const logEntry: InMemoryLogEntry = {
      ...entry,
      id: this.generateId(),
    };
    this.logs.push(logEntry);
    
    // 最大サイズを超えたら古いログを削除
    if (this.logs.length > this.maxSize) {
      this.logs = this.logs.slice(-this.maxSize);
    }
    
    this.notifyListeners();
  }

  writeAction(entry: ActionLogEntry): void {
    const actionEntry: InMemoryActionLogEntry = {
      ...entry,
      id: this.generateId(),
    };
    this.actionLogs.push(actionEntry);
    
    if (this.actionLogs.length > this.maxSize) {
      this.actionLogs = this.actionLogs.slice(-this.maxSize);
    }
    
    this.notifyListeners();
  }

  /**
   * 通常ログを取得
   */
  getLogs(options?: LogFilterOptions): InMemoryLogEntry[] {
    let result = [...this.logs];
    
    if (options?.level !== undefined) {
      result = result.filter(log => log.level >= options.level!);
    }
    
    if (options?.component) {
      result = result.filter(log => 
        log.component.toLowerCase().includes(options.component!.toLowerCase())
      );
    }
    
    if (options?.keyword) {
      const keyword = options.keyword.toLowerCase();
      result = result.filter(log => 
        log.message.toLowerCase().includes(keyword) ||
        log.component.toLowerCase().includes(keyword)
      );
    }
    
    if (options?.limit) {
      result = result.slice(-options.limit);
    }
    
    return result;
  }

  /**
   * アクションログを取得
   */
  getActionLogs(options?: LogFilterOptions): InMemoryActionLogEntry[] {
    let result = [...this.actionLogs];
    
    if (options?.level !== undefined) {
      result = result.filter(log => log.level >= options.level!);
    }
    
    if (options?.component) {
      result = result.filter(log => 
        log.component.toLowerCase().includes(options.component!.toLowerCase())
      );
    }
    
    if (options?.keyword) {
      const keyword = options.keyword.toLowerCase();
      result = result.filter(log => 
        log.message.toLowerCase().includes(keyword) ||
        log.component.toLowerCase().includes(keyword)
      );
    }
    
    if (options?.limit) {
      result = result.slice(-options.limit);
    }
    
    return result;
  }

  /**
   * 全ログ（通常ログ + アクションログ）を時系列で取得
   */
  getAllLogs(options?: LogFilterOptions): InMemoryLogEntry[] {
    const all = [...this.logs, ...this.actionLogs].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
    
    let result = all;
    
    if (options?.level !== undefined) {
      result = result.filter(log => log.level >= options.level!);
    }
    
    if (options?.component) {
      result = result.filter(log => 
        log.component.toLowerCase().includes(options.component!.toLowerCase())
      );
    }
    
    if (options?.keyword) {
      const keyword = options.keyword.toLowerCase();
      result = result.filter(log => 
        log.message.toLowerCase().includes(keyword) ||
        log.component.toLowerCase().includes(keyword)
      );
    }
    
    if (options?.limit) {
      result = result.slice(-options.limit);
    }
    
    return result;
  }

  /**
   * ログをクリア
   */
  clear(): void {
    this.logs = [];
    this.actionLogs = [];
    this.notifyListeners();
  }

  /**
   * ログ件数を取得
   */
  getCount(): { logs: number; actionLogs: number; total: number } {
    return {
      logs: this.logs.length,
      actionLogs: this.actionLogs.length,
      total: this.logs.length + this.actionLogs.length,
    };
  }

  /**
   * 変更リスナーを追加
   */
  addListener(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // リスナーエラーは無視
      }
    }
  }
}
