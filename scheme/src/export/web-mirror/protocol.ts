/**
 * Web Mirror - WebSocket 通信协议
 * 定义服务端推送和客户端接收的消息类型
 */

/** 服务端 → 客户端消息类型 */
export type ServerMessage =
  | SnapshotMessage
  | NodeAddedMessage
  | PhaseChangeMessage
  | StatsUpdateMessage
  | ExplorationStartMessage
  | SessionCompleteMessage;

/** 全量状态快照（首次连接 / 重连时发送） */
export interface SnapshotMessage {
  type: 'snapshot';
  data: MirrorState;
}

/** 增量：新节点添加 */
export interface NodeAddedMessage {
  type: 'node_added';
  explorationId: string;
  node: MirrorNode;
}

/** 增量：阶段切换 */
export interface PhaseChangeMessage {
  type: 'phase_change';
  explorationId: string;
  phase: 'explore' | 'execute' | 'verify' | 'idle';
}

/** 增量：统计更新 */
export interface StatsUpdateMessage {
  type: 'stats_update';
  stats: MirrorStats;
}

/** 增量：新的 exploration 开始 */
export interface ExplorationStartMessage {
  type: 'exploration_start';
  exploration: MirrorExploration;
}

/** Session 完成 */
export interface SessionCompleteMessage {
  type: 'session_complete';
  timestamp: number;
}

/** Mirror 全局状态 */
export interface MirrorState {
  sessionId: string;
  projectDir: string;
  startedAt: number;
  currentPhase: string;
  explorations: MirrorExploration[];
  stats: MirrorStats;
  isRunning: boolean;
}

/** Mirror Exploration 轻量版 */
export interface MirrorExploration {
  id: string;
  question: string;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'complete' | 'interrupted';
  currentPhase: string;
  phaseSeen: { explore: boolean; execute: boolean; verify: boolean };
  errorCounts: { tool: number; system: number; result: number };
  nodes: MirrorNode[];
}

/** Mirror Node 轻量版 */
export interface MirrorNode {
  id: string;
  timestamp: number;
  type: 'tool' | 'result' | 'response' | 'thinking' | 'error';
  label: string;
  status?: 'running' | 'ok' | 'error';
  phase?: string;
  toolName?: string;
}

/** Mirror 统计信息 */
export interface MirrorStats {
  totalTools: number;
  totalErrors: number;
  totalExplorations: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  uptimeMs: number;
}