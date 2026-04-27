import type { CliEventEnvelope } from './protocol';
import type { ActivityNode, ActivityTree } from './types';
import { analyzeActivity } from './activity-analyzer';
import { toPreview } from '../utils/string';

let _nodeCounter = 0;

function nextId(prefix: string): string {
  _nodeCounter++;
  return `${prefix}_${Date.now()}_${_nodeCounter}`;
}

export interface TreeCallbacks {
  onChange: (tree: ActivityTree) => void;
  onComplete: () => void;
  onError: (error: string) => void;
}

// Each node is a sibling under the prompt root.
// Tool_result is appended as a sibling with the matching toolCallId reference.
export class ActivityTreeBuilder {
  private tree: ActivityTree;
  private callbacks: TreeCallbacks;

  // Tracking
  private promptNodeId: string;
  private responseNodeId: string | null = null;
  private responseParts: string[] = [];

  // For analysis
  private recentToolNames: string[] = [];
  private recentBashCommands: string[] = [];

  // Track pending tool_calls so we can mark results
  private completedToolCallIds = new Set<string>();

  constructor(prompt: string, callbacks: TreeCallbacks) {
    const rootId = nextId('root');
    const rootNode: ActivityNode = {
      id: rootId,
      type: 'prompt',
      parentId: null,
      childrenIds: [],
      timestamp: Date.now(),
      content: { text: prompt }
    };

    this.tree = {
      prompt,
      rootId,
      nodes: new Map([[rootId, rootNode]]),
      phase: { current: 'idle', history: [] },
      stats: { toolCallCount: 0, thinkingCount: 0, responseCount: 0, repeatCount: 0 },
      alerts: [],
      fileAccess: new Map()
    };
    this.promptNodeId = rootId;
    this.callbacks = callbacks;
  }

  addEvent(event: CliEventEnvelope): void {
    const type = event.event.type;
    const payload = event.event.payload;

    switch (type) {
      case 'tool_use': {
        this.flushResponse();

        const toolCallId = payload.toolCallId as string | undefined;
        const toolName = (payload.name as string) || 'unknown';
        const input = payload.input as Record<string, unknown> | undefined;

        // Track file access
        if (input && typeof input.path === 'string') {
          this.trackFileAccess(input.path);
        }

        // Track tool name for phase detection
        this.recentToolNames.push(toolName);
        if (this.recentToolNames.length > 10) this.recentToolNames.shift();

        // Track bash command for phase detection
        if (toolName === 'Bash' && input && typeof input.command === 'string') {
          this.recentBashCommands.push(input.command);
          if (this.recentBashCommands.length > 10) this.recentBashCommands.shift();
        } else if (toolName !== 'Bash') {
          this.recentBashCommands.push('');
          if (this.recentBashCommands.length > 10) this.recentBashCommands.shift();
        }

        const node: ActivityNode = {
          id: nextId('tool'),
          type: 'tool_call',
          parentId: this.promptNodeId,
          childrenIds: [],
          timestamp: Date.now(),
          content: { toolCallId, name: toolName, input: input ?? {} },
          phase: this.tree.phase.current
        };
        this.addNode(node);

        if (toolCallId) {
          this.completedToolCallIds.add(toolCallId);
        }

        this.tree.stats.toolCallCount++;
        break;
      }

      case 'tool_result': {
        const toolCallId = payload.toolCallId as string | undefined;
        const isError = payload.isError === true;

        // Create a result node as sibling of the tool_call
        const node: ActivityNode = {
          id: nextId('result'),
          type: 'tool_result',
          parentId: this.promptNodeId,
          childrenIds: [],
          timestamp: Date.now(),
          content: {
            toolCallId,
            isError,
            contentPreview: toPreview(payload.content, 200)
          }
        };
        this.addNode(node);
        break;
      }

      case 'text_delta': {
        const text = payload.text as string | undefined;
        if (!text) return;

        if (!this.responseNodeId) {
          this.responseNodeId = nextId('response');
          this.responseParts = [];
          const node: ActivityNode = {
            id: this.responseNodeId,
            type: 'response',
            parentId: this.promptNodeId,
            childrenIds: [],
            timestamp: Date.now(),
            content: { text: '' }
          };
          this.addNode(node);
          this.tree.stats.responseCount++;
        }

        this.responseParts.push(text);
        const node = this.tree.nodes.get(this.responseNodeId!);
        if (node) {
          node.content = { text: this.responseParts.join('') };
        }
        break;
      }

      case 'text_final': {
        this.flushResponse();
        break;
      }

      case 'completion': {
        this.flushResponse();
        const isError = payload.isError === true;
        const text = payload.text as string | undefined;
        if (isError && text) {
          const node: ActivityNode = {
            id: nextId('error'),
            type: 'thinking',
            parentId: this.promptNodeId,
            childrenIds: [],
            timestamp: Date.now(),
            content: { error: text }
          };
          this.addNode(node);
          this.callbacks.onError(text);
        }
        break;
      }

      case 'status': {
        const status = payload.status as string | undefined;
        if (status?.includes('stream_init')) {
          const node: ActivityNode = {
            id: nextId('think'),
            type: 'thinking',
            parentId: this.promptNodeId,
            childrenIds: [],
            timestamp: Date.now(),
            content: { status: 'initialized', details: status }
          };
          this.addNode(node);
          this.tree.stats.thinkingCount++;
        }
        break;
      }

      case 'error': {
        const msg = payload.message as string | undefined;
        if (msg && !msg.includes('parse_failed')) {
          const node: ActivityNode = {
            id: nextId('error'),
            type: 'thinking',
            parentId: this.promptNodeId,
            childrenIds: [],
            timestamp: Date.now(),
            content: { error: msg }
          };
          this.addNode(node);
          this.callbacks.onError(msg);
        }
        break;
      }
    }

    this.runAnalysis();
    this.callbacks.onChange(this.tree);
  }

  markComplete(): void {
    this.flushResponse();
    this.callbacks.onComplete();
  }

  getTree(): ActivityTree {
    return this.tree;
  }

  private addNode(node: ActivityNode): void {
    this.tree.nodes.set(node.id, node);
    if (node.parentId) {
      const parent = this.tree.nodes.get(node.parentId);
      if (parent && !parent.childrenIds.includes(node.id)) {
        parent.childrenIds.push(node.id);
      }
    }
  }

  private flushResponse(): void {
    if (this.responseNodeId) {
      const node = this.tree.nodes.get(this.responseNodeId);
      if (node && this.responseParts.length > 0) {
        node.content = { text: this.responseParts.join('') };
      }
    }
    this.responseNodeId = null;
    this.responseParts = [];
  }

  private trackFileAccess(path: string): void {
    const current = this.tree.fileAccess.get(path) || 0;
    this.tree.fileAccess.set(path, current + 1);
  }

  private runAnalysis(): void {
    const result = analyzeActivity(this.recentToolNames, this.recentBashCommands, this.tree);
    this.tree.phase = result.phase;
    this.tree.alerts = result.alerts;
    this.tree.stats.repeatCount = result.alerts.reduce((sum, a) => sum + a.count, 0);
  }
}
