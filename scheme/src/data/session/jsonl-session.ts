/**
 * Claude session JSONL parsing (data layer).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CliEventEnvelope, ParseContext } from '../../domain/protocol';
import { parseClaudeJsonLine } from '../protocol/jsonl-line-parser';
import { ActivityTreeBuilder } from '../../domain/tree-builder';
import { truncate, toPreview } from '../../utils/string';
import type {
  Exploration,
  ExplorationNode,
  FileActivity,
  FileActivityAction,
  SessionStats,
} from './session-types';

export type { Exploration, ExplorationNode, SessionStats } from './session-types';


/**
 * Extract the last-prompt from a session JSONL file.
 * Scans for type=last-prompt entries first, falls back to first user message.
 */
export function extractLastPrompt(jsonlPath: string): string {
  const content = fs.readFileSync(jsonlPath, 'utf-8');
  const lines = content.split('\n');

  // Pass 1: look for type=last-prompt (newest-first)
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type === 'last-prompt' && entry.lastPrompt) {
        return entry.lastPrompt;
      }
    } catch { /* skip */ }
  }

  // Pass 2: fallback to first user message text
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== 'user' || !entry.message?.content) continue;
      const content = entry.message.content;
      if (typeof content === 'string') return content.slice(0, 200);
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text) return block.text.slice(0, 200);
        }
      }
    } catch { /* skip */ }
  }
  return 'unknown';
}

/**
 * Detect if the session is ongoing. Scans the last few entries:
 * - Last entry is assistant with tool_use or thinking blocks → ongoing
 * - Last entry is result → complete
 */
export function isSessionOngoing(jsonlPath: string): boolean {
  const content = fs.readFileSync(jsonlPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const entry = JSON.parse(lines[i]);
      if (entry.type === 'result') {
        return false;
      }
      if (entry.type === 'user') {
        // User turn landed but assistant completion not finalized yet.
        return true;
      }
      if (entry.type === 'assistant' && entry.message?.content) {
        const blocks = entry.message.content;
        if (Array.isArray(blocks)) {
          for (const block of blocks) {
            if (
              block.type === 'tool_use' ||
              block.type === 'thinking' ||
              block.type === 'redacted_thinking'
            ) {
              return true;
            }
          }
        }
        return false; // assistant with text output means a turn completed
      }
    } catch { /* skip */ }
  }
  return false;
}

function nonEmptyJsonlLines(jsonlPath: string, preloadedContent?: string): string[] {
  const content = preloadedContent ?? fs.readFileSync(jsonlPath, 'utf-8');
  return content.split('\n').filter((l) => l.trim());
}

function asNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function parseTimestamp(value: unknown): number {
  if (typeof value !== 'string') return Date.now();
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : Date.now();
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripAnsi(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/\u001b\[[0-9;]*m/g, '');
}

function isOperationalMetaText(text: string): boolean {
  const normalized = normalize(text).toLowerCase();
  return (
    normalized.includes('<local-command-caveat>') ||
    normalized.includes('<local-command-stdout>') ||
    normalized.includes('<command-name>') ||
    normalized.includes('<command-message>') ||
    normalized.includes('<command-args>')
  );
}

function extractSlashCommandText(text: string): string {
  const commandName = text.match(/<command-name>\s*([^<]+?)\s*<\/command-name>/i)?.[1];
  if (commandName?.trim()) return commandName.trim();

  const commandMessage = text.match(/<command-message>\s*([^<]+?)\s*<\/command-message>/i)?.[1];
  if (!commandMessage?.trim()) return '';
  const normalized = commandMessage.trim();
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

function firstTextContent(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const m = message as { content?: unknown };
  const content = m.content;
  if (typeof content === 'string') {
    const cleaned = normalize(stripAnsi(content));
    const command = extractSlashCommandText(cleaned);
    if (command) return command;
    return isOperationalMetaText(cleaned) ? '' : cleaned;
  }
  if (!Array.isArray(content)) return '';
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const b = block as { type?: unknown; text?: unknown };
    if (b.type === 'text' && typeof b.text === 'string') {
      const cleaned = normalize(stripAnsi(b.text));
      const command = extractSlashCommandText(cleaned);
      if (command) return command;
      if (!isOperationalMetaText(cleaned)) return cleaned;
    }
  }
  return '';
}

function isInterruptedQuestion(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized.includes('request interrupted by user for tool use');
}

function detectPhaseForTool(toolName: string, toolInput: unknown): 'explore' | 'execute' | 'verify' {
  const name = toolName.toLowerCase();
  const inputStr = toPreview(toolInput, 200).toLowerCase();
  const verifyKeywords = ['test', 'pytest', 'jest', 'mocha', 'lint', 'build', 'compile', 'run'];
  const executeTools = ['edit', 'write', 'multiedit', 'notebookedit'];
  const exploreTools = ['read', 'grep', 'glob', 'search', 'ls'];

  if (name === 'bash' && verifyKeywords.some((kw) => inputStr.includes(kw))) {
    return 'verify';
  }
  if (executeTools.includes(name)) {
    return 'execute';
  }
  if (exploreTools.includes(name) || name === 'bash') {
    return 'explore';
  }
  return 'explore';
}

function markPhase(exploration: Exploration, phase: 'explore' | 'execute' | 'verify'): void {
  exploration.phaseSeen[phase] = true;
  exploration.currentPhase = phase;
}

function objectField(input: unknown, key: string): unknown {
  if (!input || typeof input !== 'object') return undefined;
  return (input as Record<string, unknown>)[key];
}

function stringField(input: unknown, key: string): string {
  const value = objectField(input, key);
  return typeof value === 'string' ? value : '';
}

function numberField(input: unknown, key: string): number {
  const value = objectField(input, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function lineCount(value: string): number {
  if (!value) return 0;
  return value.split('\n').length;
}

function compactPath(value: string): string {
  const clean = value.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts.length === 0) return value.trim();
  if (!clean.startsWith('/') && parts.length <= 3) return parts.join('/');
  const tail = parts.slice(-3).join('/');
  return clean.startsWith('/') ? `…/${tail}` : tail;
}

function shellWords(command: string): string[] {
  const words: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaping = false;

  for (const ch of command) {
    if (escaping) {
      current += ch;
      escaping = false;
      continue;
    }
    if (ch === '\\' && quote !== "'") {
      escaping = true;
      continue;
    }
    if ((ch === '"' || ch === "'") && quote === null) {
      quote = ch;
      continue;
    }
    if (ch === quote) {
      quote = null;
      continue;
    }
    if (/\s/.test(ch) && quote === null) {
      if (current) {
        words.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (current) words.push(current);
  return words;
}

function isShellOperator(value: string): boolean {
  return value === '|' || value === '||' || value === '&&' || value === ';' || value === '>' || value === '>>' || value === '<';
}

function looksLikePath(value: string): boolean {
  if (!value || value.startsWith('-') || isShellOperator(value)) return false;
  if (value.includes('=') && !value.includes('/')) return false;
  return value === '.'
    || value === '..'
    || value.startsWith('/')
    || value.startsWith('./')
    || value.startsWith('../')
    || value.includes('/');
}

function basenameCommand(value: string): string {
  return value.split('/').pop()?.toLowerCase() ?? value.toLowerCase();
}

function firstPathAfterCommand(words: string[], commandIndex: number): string | undefined {
  for (let index = commandIndex + 1; index < words.length; index += 1) {
    const word = words[index];
    if (isShellOperator(word)) break;
    if (looksLikePath(word)) return word;
  }
  return undefined;
}

function lastPathAfterCommand(words: string[], commandIndex: number): string | undefined {
  let result: string | undefined;
  for (let index = commandIndex + 1; index < words.length; index += 1) {
    const word = words[index];
    if (isShellOperator(word)) break;
    if (looksLikePath(word)) result = word;
  }
  return result;
}

function extractBashTargetPath(command: string): string | undefined {
  const words = shellWords(command);
  for (let index = 0; index < words.length; index += 1) {
    const name = basenameCommand(words[index]);
    if (name === 'ls' || name === 'find' || name === 'fd') {
      return firstPathAfterCommand(words, index);
    }
    if (name === 'rg' || name === 'grep') {
      return lastPathAfterCommand(words, index);
    }
  }
  return undefined;
}

function buildFileActivity(toolName: string, input: unknown, phase: 'explore' | 'execute' | 'verify'): FileActivity | undefined {
  const name = toolName.toLowerCase();
  const make = (action: FileActivityAction, summary: string, filePath?: string): FileActivity => ({
    action,
    status: 'running',
    path: filePath || undefined,
    summary,
  });

  if (name === 'read') {
    const filePath = stringField(input, 'file_path') || stringField(input, 'path');
    if (!filePath) return undefined;
    const limit = numberField(input, 'limit');
    const offset = numberField(input, 'offset') || 1;
    const range = limit > 0 ? ` - lines ${offset}-${offset + limit - 1}` : '';
    return make('read', `${compactPath(filePath)}${range}`, filePath);
  }

  if (name === 'grep') {
    const pattern = stringField(input, 'pattern');
    const glob = stringField(input, 'glob');
    const filePath = stringField(input, 'path');
    const target = glob || (filePath ? compactPath(filePath) : '');
    const summary = pattern
      ? `"${truncate(pattern, 30)}"${target ? ` in ${target}` : ''}`
      : 'Grep';
    return make('search', summary, filePath || undefined);
  }

  if (name === 'glob') {
    const pattern = stringField(input, 'pattern');
    const filePath = stringField(input, 'path');
    const summary = pattern
      ? `"${truncate(pattern, 30)}"${filePath ? ` in ${compactPath(filePath)}` : ''}`
      : 'Glob';
    return make('search', summary, filePath || undefined);
  }

  if (name === 'edit' || name === 'notebookedit') {
    const filePath = stringField(input, 'file_path') || stringField(input, 'path');
    if (!filePath) return undefined;
    const oldLines = lineCount(stringField(input, 'old_string'));
    const newLines = lineCount(stringField(input, 'new_string'));
    const detail = oldLines > 0 && newLines > 0
      ? oldLines === newLines
        ? ` - ${oldLines} line${oldLines === 1 ? '' : 's'}`
        : ` - ${oldLines} -> ${newLines} lines`
      : '';
    return make('edit', `${compactPath(filePath)}${detail}`, filePath);
  }

  if (name === 'multiedit') {
    const filePath = stringField(input, 'file_path') || stringField(input, 'path');
    if (!filePath) return undefined;
    const edits = objectField(input, 'edits');
    const count = Array.isArray(edits) ? edits.length : 0;
    return make('edit', `${compactPath(filePath)}${count > 0 ? ` - ${count} edits` : ''}`, filePath);
  }

  if (name === 'write') {
    const filePath = stringField(input, 'file_path') || stringField(input, 'path');
    if (!filePath) return undefined;
    const lines = lineCount(stringField(input, 'content'));
    return make('write', `${compactPath(filePath)}${lines > 0 ? ` - ${lines} lines` : ''}`, filePath);
  }

  if (name === 'bash') {
    const command = stringField(input, 'command');
    const description = stringField(input, 'description');
    const summary = description && command
      ? `${description}: ${command}`
      : description || command || 'Bash';
    const targetPath = command ? extractBashTargetPath(command) : undefined;
    return make(phase === 'verify' ? 'run' : 'search', truncate(summary, 80), targetPath);
  }

  return undefined;
}

/**
 * Aggregate live session stats from Claude JSONL:
 * - usage tokens from assistant.message.usage
 * - turns from non-meta user entries
 * - events from non-empty JSONL lines
 * - cost from result.total_cost_usd / result.cost_usd
 */
export function extractSessionStats(jsonlPath: string, preloadedContent?: string): SessionStats {
  const stats: SessionStats = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    hasUsageField: false,
    hasPositiveUsage: false,
    turns: 0,
    events: 0,
    costUsd: 0
  };

  const lines = nonEmptyJsonlLines(jsonlPath, preloadedContent);
  stats.events = lines.length;
  const countedMessageIds = new Set<string>();
  let latestContextUsage:
    | {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      hasAnyField: boolean;
    }
    | null = null;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry?.type === 'user' && entry?.isMeta !== true) {
        stats.turns += 1;
      }

      const message = entry?.message;
      const usage = message?.usage ?? entry?.usage;
      if (usage) {
        stats.hasUsageField = true;
        const messageId =
          (typeof message?.id === 'string' ? message.id : undefined) ??
          (typeof entry?.uuid === 'string' ? entry.uuid : undefined);
        if (!messageId || !countedMessageIds.has(messageId)) {
          const input = asNumber(usage.input_tokens);
          const output = asNumber(usage.output_tokens);
          const cacheRead = asNumber(usage.cache_read_input_tokens);
          const cacheWrite = asNumber(usage.cache_creation_input_tokens);
          stats.inputTokens += input;
          stats.outputTokens += output;
          stats.cacheReadTokens += cacheRead;
          stats.cacheWriteTokens += cacheWrite;
          if (input > 0 || output > 0 || cacheRead > 0 || cacheWrite > 0) {
            stats.hasPositiveUsage = true;
          }

          // Some providers report only total tokens.
          const totalTokens = asNumber(usage.total_tokens);
          if (totalTokens > 0 && asNumber(usage.input_tokens) === 0 && asNumber(usage.output_tokens) === 0) {
            stats.outputTokens += totalTokens;
            stats.hasPositiveUsage = true;
          }

          if (messageId) {
            countedMessageIds.add(messageId);
          }
        }
      }

      const contextUsage = entry?.context_window?.current_usage;
      if (contextUsage && typeof contextUsage === 'object') {
        const hasAnyField =
          contextUsage.input_tokens !== undefined ||
          contextUsage.output_tokens !== undefined ||
          contextUsage.cache_read_input_tokens !== undefined ||
          contextUsage.cache_creation_input_tokens !== undefined;
        latestContextUsage = {
          input: asNumber(contextUsage.input_tokens),
          output: asNumber(contextUsage.output_tokens),
          cacheRead: asNumber(contextUsage.cache_read_input_tokens),
          cacheWrite: asNumber(contextUsage.cache_creation_input_tokens),
          hasAnyField,
        };
      }

      if (entry?.type === 'result') {
        const total = asNumber(entry.total_cost_usd);
        const partial = asNumber(entry.cost_usd);
        if (total > 0) {
          stats.costUsd = total;
        } else if (partial > 0) {
          stats.costUsd += partial;
        }
      }
    } catch {
      // Skip malformed lines.
    }
  }

  // Prefer latest context window usage snapshot when available.
  if (latestContextUsage?.hasAnyField) {
    stats.inputTokens = latestContextUsage.input;
    stats.outputTokens = latestContextUsage.output;
    stats.cacheReadTokens = latestContextUsage.cacheRead;
    stats.cacheWriteTokens = latestContextUsage.cacheWrite;
    stats.hasUsageField = true;
    if (
      latestContextUsage.input > 0 ||
      latestContextUsage.output > 0 ||
      latestContextUsage.cacheRead > 0 ||
      latestContextUsage.cacheWrite > 0
    ) {
      stats.hasPositiveUsage = true;
    }
  }

  return stats;
}

/**
 * Build "exploration -> nodes" structure from a Claude session file.
 * Each non-meta user question starts a new exploration.
 */
export function extractExplorationsFromSession(jsonlPath: string, preloadedContent?: string): Exploration[] {
  const lines = nonEmptyJsonlLines(jsonlPath, preloadedContent);
  const explorations: Exploration[] = [];
  let current: Exploration | null = null;
  let seq = 0;
  const pendingToolCallMap = new Map<string, ExplorationNode>();

  for (const line of lines) {
    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }

    const type = entry.type;
    const timestamp = parseTimestamp(entry.timestamp);

    if (type === 'user') {
      const message = entry.message as { content?: unknown } | undefined;
      const blocks = Array.isArray(message?.content) ? message?.content as Array<Record<string, unknown>> : [];

      let handledToolResult = false;
      for (const block of blocks) {
        if (block.type !== 'tool_result') continue;
        handledToolResult = true;
        if (!current) continue;
        const toolUseId = typeof block.tool_use_id === 'string' ? block.tool_use_id : undefined;
        const isError = block.is_error === true;
        const preview = toPreview(block.content, 60);
        const existing = toolUseId ? pendingToolCallMap.get(toolUseId) : undefined;

        if (existing) {
          existing.status = isError ? 'error' : 'ok';
          if (existing.fileActivity) {
            existing.fileActivity.status = isError ? 'error' : 'ok';
          }
          if (isError) {
            existing.errorCategory = 'tool';
            current.errorCounts.tool += 1;
          }
          existing.label = `${existing.label} ${isError ? '✗' : '✓'} ${preview}`.trim();
          pendingToolCallMap.delete(toolUseId!);
        } else {
          current.nodes.push({
            id: `exp_node_${++seq}`,
            timestamp,
            type: 'result',
            status: isError ? 'error' : 'ok',
            errorCategory: isError ? 'tool' : undefined,
            label: `${isError ? 'tool error' : 'tool result'} ${preview}`.trim(),
          });
          if (isError) {
            current.errorCounts.tool += 1;
          }
        }
      }
      if (handledToolResult) continue;

      if (entry.isMeta === true) continue;

      const question = firstTextContent(message);
      if (!question) continue;
      const interrupted = isInterruptedQuestion(question);
      current = {
        id: `exp_${explorations.length + 1}`,
        question,
        startedAt: timestamp,
        status: interrupted ? 'interrupted' : 'running',
        endedAt: interrupted ? timestamp : undefined,
        completionReason: interrupted ? 'interrupted' : undefined,
        currentPhase: 'idle',
        phaseSeen: { explore: false, execute: false, verify: false },
        errorCounts: { tool: 0, system: 0, result: 0 },
        nodes: []
      };
      pendingToolCallMap.clear();
      explorations.push(current);
      continue;
    }

    if (!current) continue;

    if (type === 'assistant') {
      const message = entry.message as { content?: unknown } | undefined;
      const blocks = Array.isArray(message?.content) ? message?.content as Array<Record<string, unknown>> : [];
      for (const block of blocks) {
        if (block.type === 'tool_use') {
          const toolName = typeof block.name === 'string' ? block.name : 'unknown';
          const inputPreview = toPreview(block.input, 50);
          const rawCommand =
            block.input && typeof block.input === 'object' && typeof (block.input as Record<string, unknown>).command === 'string'
              ? (block.input as Record<string, unknown>).command as string
              : undefined;
          const phase = detectPhaseForTool(toolName, block.input);
          const fileActivity = buildFileActivity(toolName, block.input, phase);
          const node: ExplorationNode = {
            id: `exp_node_${++seq}`,
            timestamp,
            type: 'tool',
            status: 'running',
            phase,
            label: `${toolName} ${inputPreview}`.trim(),
            rawCommand: rawCommand?.trim() || undefined,
            toolCallId: typeof block.id === 'string' ? block.id : undefined,
            fileActivity,
          };
          current.nodes.push(node);
          markPhase(current, phase);
          if (node.toolCallId) {
            pendingToolCallMap.set(node.toolCallId, node);
          }
        } else if (block.type === 'text' && typeof block.text === 'string') {
          const text = normalize(block.text);
          if (text) {
            current.nodes.push({
              id: `exp_node_${++seq}`,
              timestamp,
              type: 'response',
              label: truncate(text, 88),
              rawText: text,
            });
          }
        } else if (block.type === 'thinking' && typeof block.text === 'string') {
          const text = normalize(block.text);
          if (text) {
            current.nodes.push({
              id: `exp_node_${++seq}`,
              timestamp,
              type: 'thinking',
              label: truncate(text, 88),
              rawText: text,
            });
          }
        }
      }

      // Some sessions don't emit a standalone "result" record for normal replies.
      // Treat assistant end_turn as exploration completion as well.
      const assistantMessage = entry.message as { stop_reason?: string } | undefined;
      if (assistantMessage?.stop_reason === 'end_turn' && current.status !== 'complete') {
        current.status = 'complete';
        current.endedAt = timestamp;
        current.completionReason = 'end_turn';
        if (current.currentPhase === 'idle') {
          current.currentPhase = 'explore';
        }
        pendingToolCallMap.clear();
      }
      continue;
    }

    if (type === 'result') {
      if (entry.is_error === true) {
        const preview = toPreview(entry.result ?? entry.error ?? 'result error', 80);
        current.nodes.push({
          id: `exp_node_${++seq}`,
          timestamp,
          type: 'error',
          status: 'error',
          errorCategory: 'result',
          label: preview || 'result error'
        });
        current.errorCounts.result += 1;
      }
      current.status = 'complete';
      current.endedAt = timestamp;
      current.completionReason = 'result';
      if (current.currentPhase === 'idle') {
        current.currentPhase = 'explore';
      }
      pendingToolCallMap.clear();
      continue;
    }

    if (type === 'error') {
      const preview = toPreview(entry.error ?? entry.message ?? 'error', 80);
      current.nodes.push({
        id: `exp_node_${++seq}`,
        timestamp,
        type: 'error',
        status: 'error',
        errorCategory: 'system',
        label: preview || 'error'
      });
      current.errorCounts.system += 1;
      continue;
    }
  }

  return explorations;
}

// ── Session Parsing ──

export function parseJsonlFile(jsonlPath: string, skipLines?: number, preloadedContent?: string): CliEventEnvelope[] {
  const ctx: ParseContext = {
    seq: 0,
    source: { agent: 'claude', sessionId: path.basename(jsonlPath, '.jsonl'), model: undefined },
    traceId: `trace_${Date.now()}`
  };

  const allLines = (preloadedContent ?? fs.readFileSync(jsonlPath, 'utf-8')).split('\n');
  const lines = (skipLines && skipLines > 0)
    ? allLines.filter((_, i) => i >= skipLines)
    : allLines;

  const events: CliEventEnvelope[] = [];
  for (const line of lines) {
    if (line.trim()) {
      const parsed = parseClaudeJsonLine(line, ctx);
      if (parsed) {
        events.push(parsed);
      }
    }
  }
  return events;
}

export function buildTreeFromEvents(events: CliEventEnvelope[], prompt: string) {
  const builder = new ActivityTreeBuilder(prompt, {
    onChange: () => {},
    onComplete: () => {},
    onError: () => {}
  });
  for (const event of events) {
    builder.addEvent(event);
  }
  return builder.getTree();
}
