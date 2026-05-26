import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  createLogger,
  formatContextTail,
  readLoggerConfig,
  resetLoggerConfigForTests,
  setLoggerConfigForTests,
  shortSessionId,
} from './logger';

describe('logger', () => {
  const originalEnv = { ...process.env };
  let stderrChunks: string[] = [];
  const originalWrite = process.stderr.write.bind(process.stderr);

  beforeEach(() => {
    stderrChunks = [];
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrChunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    }) as typeof process.stderr.write;
    resetLoggerConfigForTests();
  });

  afterEach(() => {
    process.stderr.write = originalWrite;
    process.env = { ...originalEnv };
    resetLoggerConfigForTests();
  });

  test('filters below min level', () => {
    setLoggerConfigForTests({ minLevel: 'warn', allowedModules: null, logFilePath: null });
    const log = createLogger('session');
    log.info('hidden');
    log.warn('visible');
    expect(stderrChunks.join('')).toContain('visible');
    expect(stderrChunks.join('')).not.toContain('hidden');
  });

  test('filters by module allowlist', () => {
    setLoggerConfigForTests({
      minLevel: 'debug',
      allowedModules: new Set(['binding']),
      logFilePath: null,
    });
    createLogger('session').info('session-msg');
    createLogger('binding').info('binding-msg');
    const out = stderrChunks.join('');
    expect(out).toContain('binding-msg');
    expect(out).not.toContain('session-msg');
  });

  test('includes compact context tail', () => {
    setLoggerConfigForTests({ minLevel: 'info', allowedModules: null, logFilePath: null });
    createLogger('runtime').info('phase', {
      sessionId: 'abc12345-0000-0000-0000-000000000000',
      phase: 'live',
      needSummary: true,
    });
    const out = stderrChunks.join('');
    expect(out).toContain('abc12345 phase');
    expect(out).toContain('phase=live');
    expect(out).toContain('needSummary=yes');
    expect(out).not.toContain('sessionId=');
  });

  test('shortSessionId and formatContextTail', () => {
    expect(shortSessionId('f868caa6-7024-45c5-a7f3-54f6661ed003')).toBe('f868caa6');
    expect(formatContextTail({
      sessionId: 'x',
      phase: 'live',
      bundleData: false,
    })).toBe('phase=live · bundleData=no');
  });

  test('appends to log file when configured', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-log-test-'));
    const file = path.join(dir, 'observer.log');
    setLoggerConfigForTests({ minLevel: 'info', allowedModules: null, logFilePath: file });
    createLogger('summary').info('file-test', { explorationId: 'exp_1' });
    const content = fs.readFileSync(file, 'utf8');
    expect(content).toContain('file-test');
    expect(content).toContain('exp_1');
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('readLoggerConfig defaults to info and logs/observer.log', () => {
    delete process.env.FLOW_LOG_LEVEL;
    delete process.env.FLOW_LOG_MODULES;
    delete process.env.FLOW_LOG_FILE;
    delete process.env.FLOW_LOG_DISABLED;
    process.env.FLOW_ROOT_DIR = path.join(os.tmpdir(), 'flow-log-root-test');
    resetLoggerConfigForTests();
    const cfg = readLoggerConfig();
    expect(cfg.minLevel).toBe('info');
    expect(cfg.allowedModules).toBeNull();
    expect(cfg.logFilePath).toBe(
      path.join(process.env.FLOW_ROOT_DIR!, 'logs', 'observer.log'),
    );
  });

  test('file-only by default does not write stderr when log file is set', () => {
    setLoggerConfigForTests({
      minLevel: 'info',
      allowedModules: null,
      logFilePath: '/tmp/flow-observer-no-stderr.log',
    });
    delete process.env.FLOW_LOG_STDERR;
    createLogger('observer').info('stderr-hidden');
    expect(stderrChunks.join('')).toBe('');
  });
});
