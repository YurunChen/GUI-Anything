export type NodeType =
  | 'prompt'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'response'
  | 'group';

export type PhaseType = 'exploring' | 'executing' | 'verifying' | 'idle';
export type AlertSeverity = 'warn' | 'error';

export interface ActivityNode {
  id: string;
  type: NodeType;
  parentId: string | null;
  childrenIds: string[];
  timestamp: number;
  content: unknown;
  phase?: PhaseType;
}

export interface PhaseState {
  current: PhaseType;
  history: Array<{ phase: PhaseType; startedAt: number; endedAt?: number }>;
}

export interface TreeStats {
  toolCallCount: number;
  thinkingCount: number;
  responseCount: number;
  repeatCount: number;
}

export interface RepeatAlert {
  tool: string;
  params: string;
  count: number;
  firstSeen: number;
  severity: AlertSeverity;
}

export type FileAccessMap = Map<string, number>;

export interface ActivityTree {
  prompt: string;
  rootId: string;
  nodes: Map<string, ActivityNode>;
  phase: PhaseState;
  stats: TreeStats;
  alerts: RepeatAlert[];
  fileAccess: FileAccessMap;
}
