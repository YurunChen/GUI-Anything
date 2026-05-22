/**
 * Claude session JSONL parsing (data layer).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CliEventEnvelope, ParseContext } from '../../domain/protocol';
import { parseClaudeJsonLine } from '../protocol/jsonl-line-parser';
import { ActivityTreeBuilder } from '../../domain/tree-builder';
import { truncate, toPreview } from '../../utils/string';
import type { Exploration, ExplorationNode, SessionStats } from './session-types';

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

function firstTextContent(message: unknown): string {
  if (!message || typeof message !== 'object') return '';
  const m = message as { content?: unknown };
  const content = m.content;
  if (typeof content === 'string') {
    const cleaned = normalize(stripAnsi(content));
    return isOperationalMetaText(cleaned) ? '' : cleaned;
  }
  if (!Array.isArray(content)) return '';
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    const b = block as { type?: unknown; text?: unknown };
    if (b.type === 'text' && typeof b.text === 'string') {
      const cleaned = normalize(stripAnsi(b.text));
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

    if (type === 'user' && entry.isMeta !== true) {
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
          const node: ExplorationNode = {
            id: `exp_node_${++seq}`,
            timestamp,
            type: 'tool',
            status: 'running',
            phase,
            label: `${toolName} ${inputPreview}`.trim(),
            rawCommand: rawCommand?.trim() || undefined,
            toolCallId: typeof block.id === 'string' ? block.id : undefined
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
