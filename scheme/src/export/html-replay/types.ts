/**
 * Session Replay HTML - 类型定义
 * 定义 Replay 数据结构，用于前端渲染
 */

export interface ReplayNode {
  id: string;
  timestamp: number;
  type: 'tool' | 'result' | 'response' | 'thinking' | 'error';
  label: string;
  detail?: string;          // 完整内容（可截断）
  status?: 'running' | 'ok' | 'error';
  phase?: 'explore' | 'execute' | 'verify';
  toolName?: string;
  filePath?: string;
  errorCategory?: 'tool' | 'system' | 'result';
}

export interface ReplayExploration {
  id: string;
  question: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'complete' | 'interrupted';
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
  nodes: ReplayNode[];
}

export interface ReplaySessionStats {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  turns: number;
  events: number;
  totalTools: number;
  totalErrors: number;
  filesAccessed: string[];
  duration: number;       // ms
}

export interface ReplaySessionData {
  version: '1.0';
  title: string;
  sessionId: string;
  projectDir: string;
  createdAt: number;
  exportedAt: number;
  stats: ReplaySessionStats;
  explorations: ReplayExploration[];
  theme?: string;         // 默认主题名称
}

export interface ExportHtmlOptions {
  outputPath?: string;
  sessionId?: string;
  stripThinking?: boolean;
  maxDetailLength?: number;
  withSummaries?: boolean;
  theme?: string;
}