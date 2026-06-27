/**
 * Claude session JSONL derived types (data layer).
 */

export interface SessionStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  hasUsageField: boolean;
  hasPositiveUsage: boolean;
  turns: number;
  events: number;
  costUsd: number;
}

export interface ExplorationNode {
  id: string;
  timestamp: number;
  type: 'tool' | 'result' | 'response' | 'thinking' | 'error';
  label: string;
  rawText?: string;
  rawCommand?: string;
  status?: 'running' | 'ok' | 'error';
  toolCallId?: string;
  phase?: 'explore' | 'execute' | 'verify';
  errorCategory?: 'tool' | 'system' | 'result';
  fileActivity?: FileActivity;
}

export type FileActivityAction = 'read' | 'search' | 'edit' | 'write' | 'run';

export interface FileActivity {
  action: FileActivityAction;
  status: 'running' | 'ok' | 'error';
  path?: string;
  summary: string;
}

export interface Exploration {
  id: string;
  question: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'complete' | 'interrupted';
  completionReason?: 'result' | 'end_turn' | 'interrupted';
  currentPhase: 'explore' | 'execute' | 'verify' | 'idle';
  phaseSeen: {
    explore: boolean;
    execute: boolean;
    verify: boolean;
  };
  errorCounts: {
    tool: number;
    system: number;
    result: number;
  };
  nodes: ExplorationNode[];
  /** Total tokens processed by assistant messages in this exploration (input+output+cache). */
  tokens?: number;
  /** Distinct file paths touched by tool calls (Edit/Write/Read/NotebookEdit). */
  files?: string[];
}
