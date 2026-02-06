import { describe, it, expect } from 'vitest';
import {
  parseLogLevel,
  logLevelToString,
  parseLogDestination,
  LogLevel,
  LogDestination,
} from './types.js';

describe('parseLogLevel', () => {
  it('debug を正しくパースする', () => {
    expect(parseLogLevel('debug')).toBe(LogLevel.DEBUG);
    expect(parseLogLevel('DEBUG')).toBe(LogLevel.DEBUG);
    expect(parseLogLevel('Debug')).toBe(LogLevel.DEBUG);
  });

  it('info を正しくパースする', () => {
    expect(parseLogLevel('info')).toBe(LogLevel.INFO);
    expect(parseLogLevel('INFO')).toBe(LogLevel.INFO);
  });

  it('warn / warning を正しくパースする', () => {
    expect(parseLogLevel('warn')).toBe(LogLevel.WARN);
    expect(parseLogLevel('warning')).toBe(LogLevel.WARN);
    expect(parseLogLevel('WARN')).toBe(LogLevel.WARN);
    expect(parseLogLevel('WARNING')).toBe(LogLevel.WARN);
  });

  it('error を正しくパースする', () => {
    expect(parseLogLevel('error')).toBe(LogLevel.ERROR);
    expect(parseLogLevel('ERROR')).toBe(LogLevel.ERROR);
  });

  it('不明な値はデフォルトで INFO を返す', () => {
    expect(parseLogLevel('unknown')).toBe(LogLevel.INFO);
    expect(parseLogLevel('')).toBe(LogLevel.INFO);
    expect(parseLogLevel('trace')).toBe(LogLevel.INFO);
  });
});

describe('logLevelToString', () => {
  it('各レベルを文字列に変換する', () => {
    expect(logLevelToString(LogLevel.DEBUG)).toBe('DEBUG');
    expect(logLevelToString(LogLevel.INFO)).toBe('INFO');
    expect(logLevelToString(LogLevel.WARN)).toBe('WARN');
    expect(logLevelToString(LogLevel.ERROR)).toBe('ERROR');
  });

  it('不明なレベルは UNKNOWN を返す', () => {
    expect(logLevelToString(99 as LogLevel)).toBe('UNKNOWN');
  });
});

describe('parseLogDestination', () => {
  it('console を正しくパースする', () => {
    expect(parseLogDestination('console')).toBe(LogDestination.CONSOLE);
    expect(parseLogDestination('CONSOLE')).toBe(LogDestination.CONSOLE);
  });

  it('database / db を正しくパースする', () => {
    expect(parseLogDestination('database')).toBe(LogDestination.DATABASE);
    expect(parseLogDestination('db')).toBe(LogDestination.DATABASE);
    expect(parseLogDestination('DATABASE')).toBe(LogDestination.DATABASE);
    expect(parseLogDestination('DB')).toBe(LogDestination.DATABASE);
  });

  it('both を正しくパースする', () => {
    expect(parseLogDestination('both')).toBe(LogDestination.BOTH);
    expect(parseLogDestination('BOTH')).toBe(LogDestination.BOTH);
  });

  it('不明な値はデフォルトで CONSOLE を返す', () => {
    expect(parseLogDestination('unknown')).toBe(LogDestination.CONSOLE);
    expect(parseLogDestination('')).toBe(LogDestination.CONSOLE);
    expect(parseLogDestination('file')).toBe(LogDestination.CONSOLE);
  });
});
