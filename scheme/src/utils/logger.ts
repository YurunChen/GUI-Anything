/**
 * Unified Flow logger — stderr + file sink (on by default).
 *
 * Env:
 * - FLOW_LOG_LEVEL: debug | info | warn | error (default: info)
 * - FLOW_LOG_MODULES: comma-separated allowlist (empty = all)
 * - FLOW_LOG_FILE: log file path (default: {FLOW_ROOT_DIR}/logs/observer.log)
 * - FLOW_LOG_DISABLED: 1 | true — no file append
 * - FLOW_LOG_STDERR: 1 | true — mirror logs to stderr (default off when file sink is on)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogModule =
  | 'binding'
  | 'session'
  | 'runtime'
  | 'summary'
  | 'bundle'
  | 'index'
  | 'observer'
  | 'wiki';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  allowedModules: Set<LogModule> | null;
  logFilePath: string | null;
}

let configCache: LoggerConfig | null = null;
let fileSinkEnsured = false;

/** @internal Reset cached config (tests). */
export function resetLoggerConfigForTests(): void {
  configCache = null;
  fileSinkEnsured = false;
}

/** @internal Override config (tests). */
export function setLoggerConfigForTests(override: Partial<LoggerConfig> | null): void {
  if (override === null) {
    configCache = null;
    fileSinkEnsured = false;
    return;
  }
  const base = readLoggerConfig();
  configCache = {
    minLevel: override.minLevel ?? base.minLevel,
    allowedModules: override.allowedModules !== undefined
      ? override.allowedModules
      : base.allowedModules,
    logFilePath: override.logFilePath !== undefined
      ? override.logFilePath
      : base.logFilePath,
  };
  fileSinkEnsured = false;
}

function parseLogLevel(raw: string | undefined): LogLevel {
  const v = (raw || 'info').trim().toLowerCase();
  if (v === 'debug' || v === 'info' || v === 'warn' || v === 'error') return v;
  return 'info';
}

function parseModules(raw: string | undefined): Set<LogModule> | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const allowed = new Set<LogModule>();
  for (const part of trimmed.split(',')) {
    const m = part.trim().toLowerCase() as LogModule;
    if (m) allowed.add(m);
  }
  return allowed.size > 0 ? allowed : null;
}

function isLogDisabled(): boolean {
  const v = (process.env.FLOW_LOG_DISABLED || '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Repo-relative logs directory: `<root>/logs`. */
export function resolveFlowLogsDir(): string {
  const root = (
    process.env.FLOW_ROOT_DIR
    || process.env.FLOW_PROJECT_DIR
    || process.cwd()
  ).trim();
  return path.join(root, 'logs');
}

/** Default observer log file under project `logs/`. */
export function resolveDefaultLogFilePath(): string {
  return path.join(resolveFlowLogsDir(), 'observer.log');
}

function resolveLogFilePath(): string | null {
  if (isLogDisabled()) return null;
  const explicit = (process.env.FLOW_LOG_FILE || '').trim();
  if (explicit === '0' || explicit === 'off' || explicit === 'none') return null;
  if (explicit) return explicit;
  return resolveDefaultLogFilePath();
}

export function readLoggerConfig(): LoggerConfig {
  const minLevel = parseLogLevel(process.env.FLOW_LOG_LEVEL);
  const allowedModules = parseModules(process.env.FLOW_LOG_MODULES);
  const logFilePath = resolveLogFilePath();
  return { minLevel, allowedModules, logFilePath };
}

function getConfig(): LoggerConfig {
  if (!configCache) {
    configCache = readLoggerConfig();
  }
  return configCache;
}

function shouldLog(config: LoggerConfig, level: LogLevel, module: LogModule): boolean {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[config.minLevel]) return false;
  if (config.allowedModules && !config.allowedModules.has(module)) return false;
  return true;
}

function serializeContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) return '';
  const tail = formatContextTail(context);
  return tail ? ` | ${tail}` : '';
}

/** First 8 chars of session UUID for readable logs. */
export function shortSessionId(sessionId?: string): string {
  const s = (sessionId || '').trim();
  if (!s) return '';
  return s.length > 8 ? s.slice(0, 8) : s;
}

const CONTEXT_OMIT_FROM_TAIL = new Set([
  'sessionId',
  'explorationId',
  'cwd',
  'logFile',
  'sessionPath',
  'jsonlPath',
]);

function formatContextValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') {
    if (Number.isInteger(value) && Math.abs(value) > 1e12) {
      return new Date(value).toISOString();
    }
    return String(value);
  }
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

/** Compact key=value tail; booleans as yes/no. */
export function formatContextTail(
  context: Record<string, unknown>,
  extraOmit: string[] = [],
): string {
  const omit = new Set([...CONTEXT_OMIT_FROM_TAIL, ...extraOmit]);
  const parts: string[] = [];
  for (const [key, value] of Object.entries(context)) {
    if (omit.has(key) || value === undefined) continue;
    parts.push(`${key}=${formatContextValue(value)}`);
  }
  return parts.join(' · ');
}

function formatScope(context?: Record<string, unknown>): string {
  if (!context) return '';
  const sid = shortSessionId(String(context.sessionId ?? ''));
  const exp = context.explorationId ? String(context.explorationId) : '';
  if (sid && exp) return `${sid}/${exp}`;
  if (sid) return sid;
  if (exp) return exp;
  return '';
}

function formatLine(
  level: LogLevel,
  module: LogModule,
  message: string,
  context?: Record<string, unknown>,
): string {
  const ts = new Date().toISOString();
  const scope = formatScope(context);
  const scopePart = scope ? ` ${scope}` : '';
  return `${ts} ${level.toUpperCase().padEnd(5)} [${module}]${scopePart} ${message}${serializeContext(context)}`;
}

function ensureFileSink(filePath: string): void {
  if (fileSinkEnsured) return;
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fileSinkEnsured = true;
}

function shouldMirrorToStderr(logFilePath: string | null): boolean {
  const v = (process.env.FLOW_LOG_STDERR || '').trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  // Default: file-only so OpenTUI observer is not corrupted by log lines on stderr.
  return !logFilePath;
}

function writeLine(line: string, filePath: string | null): void {
  if (shouldMirrorToStderr(filePath)) {
    process.stderr.write(line);
  }
  if (!filePath) return;
  try {
    ensureFileSink(filePath);
    fs.appendFileSync(filePath, line);
  } catch {
    if (!shouldMirrorToStderr(filePath)) {
      process.stderr.write(line);
    }
  }
}

function log(module: LogModule, level: LogLevel, message: string, context?: Record<string, unknown>): void {
  const config = getConfig();
  if (!shouldLog(config, level, module)) return;
  const line = formatLine(level, module, message, context);
  writeLine(`${line}\n`, config.logFilePath);
}

export function createLogger(module: LogModule): Logger {
  return {
    debug: (message, context) => log(module, 'debug', message, context),
    info: (message, context) => log(module, 'info', message, context),
    warn: (message, context) => log(module, 'warn', message, context),
    error: (message, context) => log(module, 'error', message, context),
  };
}
