/**
 * ABOUTME: Incremental parsing cache for live observer.
 * Tracks parsed line offsets to avoid full re-parse on every tick.
 */

import * as fs from 'node:fs';
import type { CliEventEnvelope } from '../../domain/protocol';
import { parseClaudeJsonLine } from '../../services/protocol/parser';

export interface IncrementalParseState {
  // File tracking
  path: string;
  fileSize: number;
  mtimeMs: number;

  // Parse tracking
  parsedLineCount: number;
  events: CliEventEnvelope[];
  // Keep unfinished trailing JSON line between ticks
  partialLine: string;

  // For explorations
  explorationState: {
    currentExplorationIdx: number;
    nodeSeq: number;
  };
}

export function createEmptyIncrementalState(): IncrementalParseState {
  return {
    path: '',
    fileSize: 0,
    mtimeMs: 0,
    parsedLineCount: 0,
    events: [],
    partialLine: '',
    explorationState: {
      currentExplorationIdx: 0,
      nodeSeq: 0,
    },
  };
}

/**
 * Check if file has new content that needs parsing
 */
export function hasNewContent(
  absPath: string,
  state: IncrementalParseState
): { hasNew: false } | { hasNew: true; newContent: string; isTruncated: boolean } {
  let st: fs.Stats;
  try {
    st = fs.statSync(absPath);
  } catch {
    return { hasNew: false };
  }

  // First time or different file
  if (state.path !== absPath || state.fileSize === 0) {
    const content = fs.readFileSync(absPath, 'utf-8');
    return { hasNew: true, newContent: content, isTruncated: true };
  }

  // No change
  if (st.size === state.fileSize && st.mtimeMs === state.mtimeMs) {
    return { hasNew: false };
  }

  // File truncated or reset
  if (st.size < state.fileSize) {
    const content = fs.readFileSync(absPath, 'utf-8');
    return { hasNew: true, newContent: content, isTruncated: true };
  }

  // Append-only case - read just the new portion
  if (st.size > state.fileSize) {
    const fd = fs.openSync(absPath, 'r');
    try {
      const byteLen = st.size - state.fileSize;
      const buf = Buffer.alloc(byteLen);
      fs.readSync(fd, buf, 0, byteLen, state.fileSize);
      const newContent = buf.toString('utf-8');
      return { hasNew: true, newContent, isTruncated: false };
    } finally {
      fs.closeSync(fd);
    }
  }

  // Same size but mtime changed - re-read to be safe
  const content = fs.readFileSync(absPath, 'utf-8');
  const lines = content.split('\n');
  const oldLines = state.parsedLineCount;

  if (lines.length <= oldLines) {
    // No new lines, just content change
    return { hasNew: false };
  }

  const newContent = lines.slice(oldLines).join('\n');
  return { hasNew: true, newContent, isTruncated: false };
}

/**
 * Incrementally parse new content
 */
export function incrementalParse(
  newContent: string,
  state: IncrementalParseState,
  isTruncated: boolean
): { events: CliEventEnvelope[]; hasNewEvents: boolean } {
  if (isTruncated) {
    // Full reset
    state.events = [];
    state.parsedLineCount = 0;
    state.partialLine = '';
    state.explorationState = { currentExplorationIdx: 0, nodeSeq: 0 };
  }

  const mergedContent = `${state.partialLine}${newContent}`;
  const rawLines = mergedContent.split('\n');
  const hasTrailingNewline = mergedContent.endsWith('\n');
  if (!hasTrailingNewline) {
    const tail = rawLines.pop() ?? '';
    const trimmedTail = tail.trim();
    if (trimmedTail) {
      // If the tail is already a complete JSON line (no trailing newline), parse it now.
      // Otherwise keep it for the next tick.
      try {
        JSON.parse(trimmedTail);
        rawLines.push(tail);
        state.partialLine = '';
      } catch {
        state.partialLine = tail;
      }
    } else {
      state.partialLine = '';
    }
  } else {
    state.partialLine = '';
  }

  const lines = rawLines.filter((l) => l.trim());
  if (lines.length === 0) {
    return { events: [], hasNewEvents: false };
  }

  const ctx = {
    seq: state.parsedLineCount,
    source: { agent: 'claude' as const, sessionId: '', model: undefined },
    traceId: `trace_${Date.now()}`,
  };

  const newEvents: CliEventEnvelope[] = [];
  for (const line of lines) {
    ctx.seq++;
    const parsed = parseClaudeJsonLine(line, ctx);
    newEvents.push(...parsed);
  }

  state.parsedLineCount += lines.length;
  state.events.push(...newEvents);

  return { events: newEvents, hasNewEvents: newEvents.length > 0 };
}

/**
 * Update file stats after processing
 */
export function updateStateAfterParse(
  absPath: string,
  st: fs.Stats,
  state: IncrementalParseState
): void {
  state.path = absPath;
  state.fileSize = st.size;
  state.mtimeMs = st.mtimeMs;
}
