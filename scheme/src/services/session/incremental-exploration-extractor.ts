/**
 * Incremental Exploration Extractor
 * 增量式提取 explorations，避免每次全量重建
 */

import type { Exploration, ExplorationNode } from './posthoc';
import type { CliEventEnvelope } from '../../domain/protocol';
import { toPreview, truncate, normalizeWhitespace } from '../../utils/string';

// Phase detection keywords (mirroring posthoc.ts logic)
const exploreTools = new Set(['Glob', 'Grep', 'Read', 'ReadFile', 'SemanticSearch', 'FindFile', 'FileSearch', 'ls']);
const verifyKeywords = ['test', 'verify', 'check', 'lint', 'format', 'ci'];
const executeTools = new Set(['Bash', 'Write', 'WriteFile', 'Shell', 'Command', 'Apply', 'Edit', 'Patch']);

type Phase = 'explore' | 'execute' | 'verify' | 'idle';

function detectPhaseForTool(toolName: string, input: unknown): Phase {
  if (exploreTools.has(toolName)) return 'explore';
  if (executeTools.has(toolName)) return 'execute';
  if (input && typeof input === 'object') {
    const cmd = (input as Record<string, unknown>).command;
    if (typeof cmd === 'string') {
      const lower = cmd.toLowerCase();
      if (verifyKeywords.some(k => lower.includes(k))) return 'verify';
    }
  }
  return 'idle';
}

function markPhase(exp: Exploration, phase: Phase): void {
  if (phase === 'explore') exp.phaseSeen.explore = true;
  if (phase === 'execute') exp.phaseSeen.execute = true;
  if (phase === 'verify') exp.phaseSeen.verify = true;
  exp.currentPhase = phase;
}

function firstTextContent(message: { content?: unknown } | undefined): string {
  if (!message?.content) return '';
  const blocks = Array.isArray(message.content) ? message.content as Array<Record<string, unknown>> : [];
  for (const block of blocks) {
    if (block.type === 'text' && typeof block.text === 'string') {
      return normalizeWhitespace(block.text) || '';
    }
  }
  return '';
}

function isInterruptedQuestion(text: string): boolean {
  return text.includes('[The session was interrupted by the user]') ||
         text.includes('[Claude Code reached the maximum output limit') ||
         text.includes('[The user ended the session') ||
         text.includes('[Claude encountered an error]');
}

function parseTimestamp(ts: unknown): number {
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
}

export interface IncrementalExplorationState {
  explorations: Exploration[];
  currentExploration: Exploration | null;
  pendingToolCallMap: Map<string, ExplorationNode>;
  seq: number;
  processedEventCount: number;
}

export function createEmptyExplorationState(): IncrementalExplorationState {
  return {
    explorations: [],
    currentExploration: null,
    pendingToolCallMap: new Map(),
    seq: 0,
    processedEventCount: 0,
  };
}

/**
 * Process a single event and update explorations incrementally
 */
export function processEventIncremental(
  event: CliEventEnvelope,
  state: IncrementalExplorationState
): void {
  const type = event.event.type;
  const payload = event.event.payload;

  // Handle user messages (start new exploration)
  if (type === 'user_message') {
    const text = payload.text as string | undefined;
    const timestamp = payload.timestamp as number | undefined ?? Date.now();

    if (!text) return;

    const interrupted = isInterruptedQuestion(text);
    const newExploration: Exploration = {
      id: `exp_${state.explorations.length + 1}`,
      question: text,
      startedAt: timestamp,
      status: interrupted ? 'interrupted' : 'running',
      endedAt: interrupted ? timestamp : undefined,
      completionReason: interrupted ? 'interrupted' : undefined,
      currentPhase: 'idle',
      phaseSeen: { explore: false, execute: false, verify: false },
      errorCounts: { tool: 0, system: 0, result: 0 },
      nodes: [],
    };

    state.pendingToolCallMap.clear();
    state.currentExploration = newExploration;
    state.explorations.push(newExploration);
    return;
  }

  if (!state.currentExploration) return;
  const current = state.currentExploration;

  // Handle tool_use from events (scheme5 protocol)
  if (type === 'tool_use') {
    const toolName = payload.name as string || 'unknown';
    const input = payload.input as Record<string, unknown> | undefined;
    const rawCommand = typeof input?.command === 'string' ? input.command : undefined;
    const toolCallId = payload.toolCallId as string | undefined;
    const timestamp = payload.timestamp as number | undefined ?? Date.now();

    const inputPreview = toPreview(input, 50);
    const phase = detectPhaseForTool(toolName, input);
    const node: ExplorationNode = {
      id: `exp_node_${++state.seq}`,
      timestamp,
      type: 'tool',
      status: 'running',
      phase: phase === 'idle' ? undefined : phase,
      label: `${toolName} ${inputPreview}`.trim(),
      rawCommand: rawCommand?.trim() || undefined,
      toolCallId,
    };

    current.nodes.push(node);
    markPhase(current, phase);
    if (toolCallId) {
      state.pendingToolCallMap.set(toolCallId, node);
    }
    return;
  }

  // Handle tool_result from events (scheme5 protocol)
  if (type === 'tool_result') {
    const toolCallId = payload.toolCallId as string | undefined;
    const isError = payload.isError === true;
    const content = payload.content;
    const preview = toPreview(content, 60);
    const timestamp = payload.timestamp as number | undefined ?? Date.now();

    const existing = toolCallId ? state.pendingToolCallMap.get(toolCallId) : undefined;

    if (existing) {
      existing.status = isError ? 'error' : 'ok';
      if (isError) {
        existing.errorCategory = 'tool';
        current.errorCounts.tool += 1;
      }
      existing.label = `${existing.label} ${isError ? '✗' : '✓'} ${preview}`.trim();
      if (toolCallId) {
        state.pendingToolCallMap.delete(toolCallId);
      }
    } else {
      current.nodes.push({
        id: `exp_node_${++state.seq}`,
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
    return;
  }

  // Handle text_delta as response
  if (type === 'text_delta') {
    const text = payload.text as string | undefined;
    const timestamp = payload.timestamp as number | undefined ?? Date.now();

    if (!text) return;

    // Find existing response node in current exploration or create new
    const lastNode = current.nodes[current.nodes.length - 1];
    if (lastNode && lastNode.type === 'response') {
      // Append to existing response
      const prevRaw = typeof lastNode.rawText === 'string' ? lastNode.rawText : lastNode.label;
      const mergedRaw = `${prevRaw}${text}`;
      lastNode.rawText = normalizeWhitespace(mergedRaw) || mergedRaw;
      lastNode.label = truncate(lastNode.rawText, 88);
    } else {
      const normalized = normalizeWhitespace(text) || '';
      current.nodes.push({
        id: `exp_node_${++state.seq}`,
        timestamp,
        type: 'response',
        label: truncate(normalized, 88),
        rawText: normalized,
      });
    }
    return;
  }

  // Handle completion signals
  if (type === 'completion' || type === 'text_final') {
    const completionReason = payload.reason as string | undefined;
    const timestamp = payload.timestamp as number | undefined ?? Date.now();

    if (current.status !== 'complete') {
      current.status = 'complete';
      current.endedAt = timestamp;
      current.completionReason =
        completionReason === 'result' || completionReason === 'interrupted' || completionReason === 'end_turn'
          ? completionReason
          : 'end_turn';
      if (current.currentPhase === 'idle') {
        current.currentPhase = 'explore';
      }
      state.pendingToolCallMap.clear();
    }
    return;
  }

  // Handle error events
  if (type === 'error') {
    const errorMessage = payload.message as string | undefined;
    const timestamp = payload.timestamp as number | undefined ?? Date.now();

    const preview = toPreview(errorMessage || 'error', 80);
    current.nodes.push({
      id: `exp_node_${++state.seq}`,
      timestamp,
      type: 'error',
      status: 'error',
      errorCategory: 'system',
      label: preview || 'error',
    });
    current.errorCounts.system += 1;

    if (current.status !== 'complete') {
      current.status = 'interrupted';
      current.endedAt = timestamp;
      current.completionReason = 'interrupted';
    }
    return;
  }
}

/**
 * Batch process multiple events incrementally
 */
export function processEventsIncremental(
  events: CliEventEnvelope[],
  state: IncrementalExplorationState
): void {
  for (const event of events) {
    processEventIncremental(event, state);
  }
  state.processedEventCount += events.length;
}

/**
 * Get explorations from current state
 */
export function getExplorationsFromState(state: IncrementalExplorationState): Exploration[] {
  return state.explorations;
}

/**
 * Reset state for full rebuild
 */
export function resetExplorationState(): IncrementalExplorationState {
  return createEmptyExplorationState();
}
